#!/usr/bin/env python3
"""
Train Loglizer Anomaly Detection Model
Trains on normal logs to learn expected behavior patterns.
"""

import os
import pickle
import sys
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

from loglizer.models import PCA

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from parser import LogParser


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


def train_model(normal_log_file='logs/normal.log', model_output='ml/model.pkl'):
    """Train anomaly detection model on normal logs."""
    print(f"Training model on {normal_log_file}...")
    
    parser = LogParser()
    
    events = parser.parse_file(normal_log_file)
    if not events:
        print(f"Error: No events found in {normal_log_file}")
        print("Please generate logs first: python ml/generate_logs.py")
        return None
    
    sessions = parser.group_by_session(events)
    event_templates = parser.get_event_templates()
    
    print(f"  Parsed {len(events)} events into {len(sessions)} sessions")
    print(f"  Found {len(event_templates)} unique event templates")
    
    sequences = parser.sessions_to_event_sequences(sessions)
    
    X = extract_features(sequences, event_templates)
    
    print(f"  Feature matrix shape: {X.shape}")
    
    model = PCA()
    print("  Training PCA model...")
    model.fit(X)
    
    os.makedirs(os.path.dirname(model_output), exist_ok=True)
    with open(model_output, 'wb') as f:
        pickle.dump({
            'model': model,
            'event_templates': event_templates,
            'trained_at': datetime.now().isoformat(),
            'num_sessions': len(sessions),
            'num_events': len(events)
        }, f)
    
    print(f"  Model saved to {model_output}")
    
    predictions = model.predict(X)
    normal_count = sum(1 for p in predictions if p == 0)
    print(f"  Model sanity check: {normal_count}/{len(predictions)} normal sessions correctly classified")
    
    return model, event_templates


def main():
    """Train model on normal logs."""
    if not os.path.exists('logs/normal.log'):
        print("Generating logs first...")
        os.system('python ml/generate_logs.py')
    
    result = train_model()
    if result:
        print("\nModel training complete!")
        return 0
    return 1


if __name__ == '__main__':
    sys.exit(main())