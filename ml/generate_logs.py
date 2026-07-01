#!/usr/bin/env python3
"""
Log Generator for Personal Finance Management Application
Generates both normal and abnormal log patterns for anomaly detection training.
"""

import random
from datetime import datetime, timedelta
import os

class LogGenerator:
    def __init__(self, seed=None):
        if seed:
            random.seed(seed)
        self.users = ['alice', 'bob', 'charlie', 'diana', 'eve', 'frank', 'grace', 'henry']
        self.categories = ['Food', 'Transport', 'Entertainment', 'Shopping', 'Bills', 'Healthcare', 'Education']
        self.current_time = datetime.now()

    def _advance(self, seconds):
        """Advance the internal clock by given seconds."""
        self.current_time += timedelta(seconds=seconds)

    def _timestamp(self):
        """Return the current timestamp string."""
        return self.current_time.strftime("%Y-%m-%d %H:%M:%S")

    def _log_line(self, level, message, **kwargs):
        """Format a log line."""
        extras = ' '.join([f'{k}={v}' for k, v in kwargs.items()])
        if extras:
            return f"{self._timestamp()} {level} {message} {extras}"
        return f"{self._timestamp()} {level} {message}"

    def generate_normal_session(self, user=None):
        """Generate a normal user session with typical finance app activities."""
        if user is None:
            user = random.choice(self.users)

        logs = []

        # Login
        logs.append(self._log_line('INFO', 'User login success', user=user))
        self._advance(random.randint(1, 5))

        # View dashboard
        logs.append(self._log_line('INFO', 'GET /dashboard', user=user))
        self._advance(random.randint(1, 3))

        # Add some expenses
        num_expenses = random.randint(1, 4)
        for _ in range(num_expenses):
            amount = random.randint(10, 500)
            category = random.choice(self.categories)
            logs.append(self._log_line('INFO', 'Added expense', amount=amount, category=category, user=user))
            self._advance(random.randint(5, 30))

        # Add some income
        if random.random() > 0.5:
            amount = random.randint(1000, 5000)
            logs.append(self._log_line('INFO', 'Added income', amount=amount, user=user))
            self._advance(random.randint(5, 15))

        # Create or update budget
        if random.random() > 0.6:
            logs.append(self._log_line('INFO', 'Budget created', category=random.choice(self.categories), user=user))
            self._advance(random.randint(3, 10))

        # View reports
        if random.random() > 0.4:
            logs.append(self._log_line('INFO', 'Monthly report generated', user=user))
            self._advance(random.randint(2, 8))

        # Logout then gap before next session
        logs.append(self._log_line('INFO', 'User logout', user=user))
        self._advance(random.randint(600, 1800))  # 10–30 min gap between sessions

        return logs
    
    def generate_normal_logs(self, num_sessions=50):
        """Generate multiple normal sessions."""
        all_logs = []
        for _ in range(num_sessions):
            all_logs.extend(self.generate_normal_session())
            all_logs.append("")  # Empty line between sessions
        return all_logs

    def generate_brute_force_login(self, user=None):
        """Generate brute-force login attempt anomaly."""
        if user is None:
            user = random.choice(self.users)

        logs = []
        num_attempts = random.randint(5, 15)

        for i in range(num_attempts):
            logs.append(self._log_line('WARN', 'Login failed', user=user, attempt=i+1))
            self._advance(random.randint(1, 10))

        if random.random() > 0.7:
            logs.append(self._log_line('INFO', 'User login success', user=user))
        else:
            logs.append(self._log_line('ERROR', 'Account locked', user=user))
        self._advance(random.randint(600, 1800))
        return logs

    def generate_server_exception(self):
        """Generate server exception anomaly."""
        exceptions = [
            'NullPointerException',
            'IndexOutOfBoundsException',
            'SQLException',
            'IOException',
            'TimeoutException'
        ]

        logs = []
        num_exceptions = random.randint(3, 10)
        exception = random.choice(exceptions)

        for _ in range(num_exceptions):
            logs.append(self._log_line('ERROR', exception))
            self._advance(random.randint(1, 5))
        self._advance(random.randint(600, 1800))
        return logs

    def generate_database_timeout(self):
        """Generate database connection timeout anomaly."""
        logs = []
        num_timeouts = random.randint(2, 5)

        for _ in range(num_timeouts):
            logs.append(self._log_line('ERROR', 'Database connection timeout'))
            self._advance(random.randint(5, 30))
        self._advance(random.randint(600, 1800))
        return logs

    def generate_unauthorized_access(self, user=None):
        """Generate unauthorized access attempt anomaly."""
        if user is None:
            user = random.choice(self.users)

        logs = []
        endpoints = ['/admin', '/settings/admin', '/api/users', '/api/admin/reports']
        num_attempts = random.randint(2, 6)

        for _ in range(num_attempts):
            endpoint = random.choice(endpoints)
            logs.append(self._log_line('WARN', 'Unauthorized access attempt', endpoint=endpoint, user=user))
            self._advance(random.randint(1, 10))
        self._advance(random.randint(600, 1800))
        return logs

    def generate_traffic_spike(self):
        """Generate traffic spike anomaly (DDoS-like pattern)."""
        logs = []
        num_requests = random.randint(100, 500)
        endpoints = ['/dashboard', '/api/expenses', '/api/income', '/api/budgets']

        for _ in range(num_requests):
            endpoint = random.choice(endpoints)
            logs.append(self._log_line('INFO', f'GET {endpoint}'))
            self._advance(random.randint(0, 2))
        self._advance(random.randint(600, 1800))
        return logs

    def generate_slow_responses(self):
        """Generate slow response time anomaly."""
        logs = []
        num_slow = random.randint(3, 8)

        for _ in range(num_slow):
            response_time = random.randint(5000, 20000)
            logs.append(self._log_line('WARN', 'Request took unusually long', response_time=f'{response_time}ms'))
            self._advance(random.randint(10, 60))
        self._advance(random.randint(600, 1800))
        return logs

    def generate_mixed_anomalies(self, num_anomalies=10):
        """Generate a mix of different anomaly types."""
        anomaly_generators = [
            self.generate_brute_force_login,
            self.generate_server_exception,
            self.generate_database_timeout,
            self.generate_unauthorized_access,
            self.generate_traffic_spike,
            self.generate_slow_responses
        ]

        all_logs = []
        for _ in range(num_anomalies):
            generator = random.choice(anomaly_generators)
            all_logs.extend(generator())
            all_logs.append("")  # Empty line between anomalies
        return all_logs
    
    def write_logs(self, logs, filename):
        """Write logs to file."""
        os.makedirs(os.path.dirname(filename), exist_ok=True)
        with open(filename, 'w') as f:
            f.write('\n'.join(logs))
        print(f"Generated {len([l for l in logs if l])} log lines in {filename}")


def main():
    """Generate training datasets."""
    generator = LogGenerator(seed=42)
    
    # Generate normal logs
    normal_logs = generator.generate_normal_logs(num_sessions=100)
    generator.write_logs(normal_logs, 'logs/normal.log')
    
    # Generate abnormal logs
    abnormal_logs = generator.generate_mixed_anomalies(num_anomalies=20)
    generator.write_logs(abnormal_logs, 'logs/abnormal.log')
    
    # Generate mixed logs for testing (mostly normal with some anomalies)
    mixed_logs = generator.generate_normal_logs(num_sessions=80)
    mixed_logs.extend(generator.generate_mixed_anomalies(num_anomalies=5))
    generator.write_logs(mixed_logs, 'logs/application.log')
    
    print("\nLog generation complete!")
    print("  - logs/normal.log: Normal behavior patterns")
    print("  - logs/abnormal.log: Anomalous behavior patterns")
    print("  - logs/application.log: Mixed logs for testing")


if __name__ == '__main__':
    main()