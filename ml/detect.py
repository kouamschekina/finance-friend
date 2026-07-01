#!/usr/bin/env python3
"""
Detect Anomalies Using Trained Loglizer Model
Analyzes log files and identifies anomalous sessions.
"""

import os
import pickle
import sys
import json
from datetime import datetime

import numpy as np

# Stub torch so loglizer's DeepLog import doesn't fail when torch isn't installed
import types as _types
if 'torch' not in sys.modules:
    _torch_stub = _types.ModuleType('torch')
    class _FakeTensor:
        pass
    _torch_stub.Tensor = _FakeTensor
    _torch_stub.nn = _types.ModuleType('torch.nn')
    _torch_stub.nn.Module = object
    _torch_stub.nn.LSTM = object
    _torch_stub.nn.Linear = object
    _torch_stub.optim = _types.ModuleType('torch.optim')
    _torch_stub.optim.Adam = object
    sys.modules['torch'] = _torch_stub
    sys.modules['torch.nn'] = _torch_stub.nn
    sys.modules['torch.optim'] = _torch_stub.optim

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from parser import LogParser

# Import PCA so pickle can reconstruct the model
from loglizer.models import PCA  # noqa: F401


def extract_features(sessions, event_templates):
    """Convert sessions to feature vectors."""
    num_events = len(event_templates)
    features = []
    
    for session in sessions:
        feature_vec = np.zeros(num_events)
        for event_id in session:
            if event_id < num_events:
                feature_vec[event_id] += 1
        features.append(feature_vec)
    
    return np.array(features)


def load_model(model_path='ml/model.pkl'):
    """Load trained model from disk."""
    if not os.path.exists(model_path):
        raise FileNotFoundError(f"Model not found at {model_path}. Run train.py first.")
    
    with open(model_path, 'rb') as f:
        data = pickle.load(f)
    
    return data['model'], data['event_templates'], data


def analyze_session(session_events, event_templates):
    """Analyze a session for anomaly indicators."""
    indicators = []
    
    error_count = 0
    warn_count = 0
    failed_login_count = 0
    db_timeout_count = 0
    unauthorized_count = 0
    exception_count = 0
    slow_response_count = 0
    
    for event in session_events:
        level = event.get('level', 'INFO')
        message = event.get('message', '')
        template = event.get('template', '')
        
        if level == 'ERROR':
            error_count += 1
            if 'Exception' in message:
                exception_count += 1
                indicators.append(f"Exception: {message}")
            if 'Database' in message and 'timeout' in message.lower():
                db_timeout_count += 1
                indicators.append("Database timeout")
        
        if level == 'WARN':
            warn_count += 1
            if 'Login failed' in message:
                failed_login_count += 1
            if 'Unauthorized' in message:
                unauthorized_count += 1
                indicators.append(f"Unauthorized access")
            if 'slow' in message.lower() or 'long' in message.lower():
                slow_response_count += 1
                indicators.append("Slow response detected")
    
    if failed_login_count >= 3:
        indicators.insert(0, f"Multiple failed logins ({failed_login_count} attempts)")
    
    if db_timeout_count >= 2:
        indicators.insert(0, f"Database connectivity issues ({db_timeout_count} timeouts)")
    
    if unauthorized_count >= 2:
        indicators.insert(0, f"Unauthorized access attempts ({unauthorized_count} attempts)")
    
    if exception_count >= 3:
        indicators.insert(0, f"Server exceptions ({exception_count} errors)")
    
    unique_indicators = []
    seen = set()
    for ind in indicators:
        if ind not in seen:
            seen.add(ind)
            unique_indicators.append(ind)
    
    return unique_indicators


def detect_anomalies(log_file='logs/application.log', model_path='ml/model.pkl'):
    """Detect anomalies in log file using trained model."""
    print(f"Detecting anomalies in {log_file}...")
    
    model, event_templates, model_info = load_model(model_path)
    print(f"  Model loaded (trained on {model_info['num_sessions']} sessions)")
    
    parser = LogParser()
    events = parser.parse_file(log_file)
    
    if not events:
        print(f"  Warning: No events found in {log_file}")
        return [], {}
    
    sessions = parser.group_by_session(events)
    sequences = parser.sessions_to_event_sequences(sessions)
    
    print(f"  Parsed {len(events)} events into {len(sessions)} sessions")
    
    X = extract_features(sequences, event_templates)
    
    predictions = model.predict(X)
    
    results = {
        'normal': [],
        'anomaly': [],
        'summary': {
            'total_sessions': len(sessions),
            'normal_count': 0,
            'anomaly_count': 0,
            'log_file': log_file,
            'model_file': model_path,
            'detection_time': datetime.now().isoformat()
        }
    }
    
    for i, (session, prediction, session_events) in enumerate(zip(sessions, predictions, sessions)):
        status = 'ANOMALY' if prediction == 1 else 'NORMAL'
        indicators = []
        
        if prediction == 1:
            indicators = analyze_session(session, event_templates)
            results['anomaly'].append({
                'session_index': i,
                'event_count': len(session),
                'indicators': indicators,
                'events_preview': [e['raw'] for e in session[:5]]
            })
            results['summary']['anomaly_count'] += 1
        else:
            results['normal'].append({
                'session_index': i,
                'event_count': len(session)
            })
            results['summary']['normal_count'] += 1
        
        if len(sessions) <= 20 or prediction == 1:
            indicator_str = f" - {', '.join(indicators)}" if indicators else ""
            print(f"  Session {i}: {status}{indicator_str}")
    
    print(f"\n  Summary: {results['summary']['normal_count']} normal, {results['summary']['anomaly_count']} anomalies")
    
    return results, model_info


def save_results(results, output_json='reports/anomalies.json'):
    """Save detection results to JSON file."""
    os.makedirs(os.path.dirname(output_json), exist_ok=True)
    
    with open(output_json, 'w') as f:
        json.dump(results, f, indent=2)
    
    print(f"  Results saved to {output_json}")


def main():
    """Run anomaly detection."""
    log_file = sys.argv[1] if len(sys.argv) > 1 else 'logs/application.log'
    
    results, model_info = detect_anomalies(log_file)
    save_results(results)
    
    return 0 if results['summary']['anomaly_count'] >= 0 else 1


if __name__ == '__main__':
    sys.exit(main())