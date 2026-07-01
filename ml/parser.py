#!/usr/bin/env python3
"""
Log Parser for Loglizer Integration
Converts raw application logs into structured format for anomaly detection.
"""

import re
import os
from datetime import datetime
from collections import defaultdict

class LogParser:
    """Parse application logs into structured events."""
    
    # Log pattern: 2026-07-01 09:12:01 INFO User login success user=alice
    LOG_PATTERN = re.compile(
        r'(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\s+'
        r'(INFO|WARN|ERROR|DEBUG)\s+'
        r'(.+)'
    )
    
    # Common log templates
    TEMPLATES = {
        'User login success': 'User login success user=*',
        'User logout': 'User logout user=*',
        'GET /dashboard': 'GET /dashboard',
        'GET /api/expenses': 'GET /api/expenses',
        'GET /api/income': 'GET /api/income',
        'GET /api/budgets': 'GET /api/budgets',
        'Added expense': 'Added expense amount=* category=* user=*',
        'Added income': 'Added income amount=* user=*',
        'Budget created': 'Budget created category=* user=*',
        'Monthly report generated': 'Monthly report generated user=*',
        'Login failed': 'Login failed user=* attempt=*',
        'Account locked': 'Account locked user=*',
        'NullPointerException': 'NullPointerException',
        'IndexOutOfBoundsException': 'IndexOutOfBoundsException',
        'SQLException': 'SQLException',
        'IOException': 'IOException',
        'TimeoutException': 'TimeoutException',
        'Database connection timeout': 'Database connection timeout',
        'Unauthorized access attempt': 'Unauthorized access attempt endpoint=* user=*',
        'Request took unusually long': 'Request took unusually long response_time=*',
    }
    
    def __init__(self):
        self.event_id_map = {}
        self.next_event_id = 0
    
    def _get_event_id(self, template):
        """Get or create event ID for a template."""
        if template not in self.event_id_map:
            self.event_id_map[template] = self.next_event_id
            self.next_event_id += 1
        return self.event_id_map[template]
    
    def _extract_template(self, message):
        """Extract log template from message."""
        # Try exact matches first
        for pattern, template in self.TEMPLATES.items():
            if message.startswith(pattern):
                return template
        
        # Extract template by replacing variable parts with *
        template = message
        
        # Replace user=xxx with user=*
        template = re.sub(r'user=\S+', 'user=*', template)
        
        # Replace amount=xxx with amount=*
        template = re.sub(r'amount=\d+', 'amount=*', template)
        
        # Replace attempt=xxx with attempt=*
        template = re.sub(r'attempt=\d+', 'attempt=*', template)
        
        # Replace category=xxx with category=*
        template = re.sub(r'category=\S+', 'category=*', template)
        
        # Replace endpoint=xxx with endpoint=*
        template = re.sub(r'endpoint=\S+', 'endpoint=*', template)
        
        # Replace response_time=xxx with response_time=*
        template = re.sub(r'response_time=\S+', 'response_time=*', template)
        
        return template
    
    def parse_line(self, line):
        """Parse a single log line."""
        line = line.strip()
        if not line:
            return None
        
        match = self.LOG_PATTERN.match(line)
        if not match:
            return None
        
        timestamp_str, level, message = match.groups()
        
        # Parse timestamp
        try:
            timestamp = datetime.strptime(timestamp_str, '%Y-%m-%d %H:%M:%S')
        except ValueError:
            timestamp = None
        
        # Extract template
        template = self._extract_template(message)
        event_id = self._get_event_id(template)
        
        return {
            'timestamp': timestamp,
            'level': level,
            'message': message,
            'template': template,
            'event_id': event_id,
            'raw': line
        }
    
    def parse_file(self, filepath):
        """Parse entire log file."""
        events = []
        
        if not os.path.exists(filepath):
            print(f"Warning: File not found: {filepath}")
            return events
        
        with open(filepath, 'r') as f:
            for line in f:
                parsed = self.parse_line(line)
                if parsed:
                    events.append(parsed)
        
        return events
    
    def group_by_session(self, events, gap_seconds=300):
        """Group events into sessions based on time gaps."""
        if not events:
            return []
        
        sessions = []
        current_session = []
        last_timestamp = None
        
        for event in events:
            if event['timestamp'] is None:
                continue
            
            if last_timestamp is None:
                current_session.append(event)
            else:
                gap = (event['timestamp'] - last_timestamp).total_seconds()
                if gap > gap_seconds:
                    # New session
                    if current_session:
                        sessions.append(current_session)
                    current_session = [event]
                else:
                    current_session.append(event)
            
            last_timestamp = event['timestamp']
        
        # Don't forget the last session
        if current_session:
            sessions.append(current_session)
        
        return sessions
    
    def sessions_to_event_sequences(self, sessions):
        """Convert sessions to event ID sequences for ML."""
        sequences = []
        
        for session in sessions:
            sequence = [event['event_id'] for event in session]
            sequences.append(sequence)
        
        return sequences
    
    def get_event_templates(self):
        """Get mapping of event IDs to templates."""
        return {v: k for k, v in self.event_id_map.items()}


def parse_logs_to_structured(log_file, output_file=None):
    """Parse logs and optionally save to structured format."""
    parser = LogParser()
    events = parser.parse_file(log_file)
    
    if output_file:
        with open(output_file, 'w') as f:
            for event in events:
                f.write(f"{event['event_id']}\t{event['level']}\t{event['template']}\n")
    
    return events, parser


def main():
    """Parse all log files."""
    parser = LogParser()
    
    # Parse normal logs
    print("Parsing normal.log...")
    normal_events = parser.parse_file('logs/normal.log')
    print(f"  Found {len(normal_events)} events")
    
    # Parse abnormal logs
    print("Parsing abnormal.log...")
    abnormal_events = parser.parse_file('logs/abnormal.log')
    print(f"  Found {len(abnormal_events)} events")
    
    # Parse application logs
    print("Parsing application.log...")
    app_events = parser.parse_file('logs/application.log')
    print(f"  Found {len(app_events)} events")
    
    # Group into sessions
    print("\nGrouping into sessions...")
    normal_sessions = parser.group_by_session(normal_events)
    abnormal_sessions = parser.group_by_session(abnormal_events)
    app_sessions = parser.group_by_session(app_events)
    
    print(f"  Normal sessions: {len(normal_sessions)}")
    print(f"  Abnormal sessions: {len(abnormal_sessions)}")
    print(f"  Application sessions: {len(app_sessions)}")
    
    # Show event templates
    print("\nEvent templates:")
    for event_id, template in sorted(parser.get_event_templates().items()):
        print(f"  {event_id}: {template}")
    
    return parser


if __name__ == '__main__':
    main()