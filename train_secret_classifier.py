#!/usr/bin/env python3
"""
train_secret_classifier.py
==========================
Trains a contextual ML classifier to distinguish real leaked secrets from
harmless test fixtures / mocks / placeholders.

Uses scikit-learn:
  - TfidfVectorizer  : converts the text context around each finding into
                       TF-IDF feature vectors (NLP keyword extraction)
  - LogisticRegression : linear classifier that learns which TF-IDF features
                         are statistically associated with "real leak" vs
                         "test fixture"

The model is trained on a synthetic labelled dataset that mimics the kinds
of findings Gitleaks would produce, then serialized to
`ml/secret_classifier_model.pkl` so `filter_secrets.py` can load it at
CI runtime without retraining.

Usage:
    python train_secret_classifier.py

Outputs:
    ml/secret_classifier_model.pkl  (pickled sklearn Pipeline + metadata)
    ml/secret_classifier_dataset.json  (the training data, for inspection)
"""

import json
import os
import pickle
import random
import string

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline

# ---------------------------------------------------------------------------
# Synthetic labelled training dataset
# ---------------------------------------------------------------------------
# Each sample mimics a Gitleaks finding: a file path, a line of code, a
# secret value, and a label (1 = REAL_LEAK, 0 = TEST_FIXTURE).
#
# We generate hundreds of realistic variations so the TF-IDF vectorizer
# learns which context tokens (path tokens, placeholder tokens, assertion
# tokens, provider prefixes) are statistically correlated with each class.
# ---------------------------------------------------------------------------

REAL_PROVIDERS = [
    "AKIA", "sk_live_", "sk_test_", "ghp_", "gho_", "ghs_",
    "xoxb-", "xoxp-", "AIza", "ya29.", "eyJ",
]

PLACEHOLDER_WORDS = [
    "dummy", "placeholder", "your_key", "your-key", "my_secret",
    "changeme", "example", "sample", "test_key", "demo",
    "foobar", "lorem", "ipsum", "xxxx", "000000", "123456",
]

TEST_PATHS = [
    "tests/fixtures.json", "tests/mocks/api.py", "test/config_spec.rb",
    "src/__tests__/secrets.test.js", "tests/fixtures/credentials.yaml",
    "spec/support/mocks.ts", "tests/example_keys.json",
    "mocks/stubs/tokens.py", "tests/samples/keys.json",
    "test/fixtures/auth_mock.js", "tests/unit/secrets.spec.ts",
]

PROD_PATHS = [
    "src/config.js", "src/services/stripe.js", "src/lib/auth.py",
    "config/production.env", ".env", "src/utils/aws.ts",
    "src/api/client.py", "app/settings.py", "src/config/database.js",
    "src/middleware/auth.ts", "server/config.js", "src/integrations/groq.ts",
]

ASSERTION_SNIPPETS = [
    "expect(secret).toBe", "assert key ==", "assertEquals(token,",
    "should.equal(apiKey,", "expect(stripeKey).toMatch",
    "assertEqual(secret,", "toMatchSnapshot()",
    "mockReturnValue('test')", "expect(result).toEqual",
]

PROD_SNIPPETS = [
    'const apiKey = "', 'const stripeKey = "', 'API_KEY = "',
    'const token = "', 'password = "', 'const secret = "',
    'SECRET_KEY = "', 'const credential = "', 'token: "',
    'authorization: "Bearer ', 'const awsKey = "',
]


def _random_secret(prefix: str, length: int = 40) -> str:
    """Generate a realistic-looking secret with a provider prefix."""
    chars = string.ascii_letters + string.digits
    body = "".join(random.choice(chars) for _ in range(length))
    return f"{prefix}{body}"


def _random_placeholder(prefix: str, placeholder: str) -> str:
    """Generate a placeholder secret that contains a tell-tale word."""
    return f"{prefix}{placeholder}{''.join(random.choices('0123456789', k=10))}"


def generate_dataset(n_samples: int = 600) -> list[dict]:
    """Generate a balanced synthetic dataset of labelled findings."""
    samples = []
    half = n_samples // 2

    # --- REAL LEAKS (label=1) ---
    for _ in range(half):
        provider = random.choice(REAL_PROVIDERS)
        secret = _random_secret(provider)
        path = random.choice(PROD_PATHS)
        snippet = random.choice(PROD_SNIPPETS)
        line = f'{snippet}{secret}"'
        # Sometimes add .env context
        if random.random() < 0.3:
            path = ".env"
        samples.append({
            "file": path,
            "line": line,
            "secret": secret,
            "label": 1,
        })

    # --- TEST FIXTURES (label=0) ---
    for _ in range(half):
        provider = random.choice(REAL_PROVIDERS)
        placeholder = random.choice(PLACEHOLDER_WORDS)
        secret = _random_placeholder(provider, placeholder)
        path = random.choice(TEST_PATHS)
        # 50/50: assertion line or plain fixture line
        if random.random() < 0.5:
            snippet = random.choice(ASSERTION_SNIPPETS)
            line = f'{snippet}{secret}"'
        else:
            line = f'"key": "{secret}"'
        samples.append({
            "file": path,
            "line": line,
            "secret": secret,
            "label": 0,
        })

    # --- DOCUMENTATION MENTIONS (label=0) ---
    # Markdown files that *describe* secrets are not leaks.
    for _ in range(half // 3):
        provider = random.choice(REAL_PROVIDERS)
        placeholder = random.choice(PLACEHOLDER_WORDS)
        secret = _random_placeholder(provider, placeholder)
        path = random.choice([
            "docs/security.md", "README.md", "docs/api-keys.md",
            "docs/secret-detection.md", "CHANGELOG.md",
        ])
        line = f'Example: `{secret}` is a placeholder used in tests.'
        samples.append({
            "file": path,
            "line": line,
            "secret": secret,
            "label": 0,
        })

    random.shuffle(samples)
    return samples


def build_text_feature(finding: dict) -> str:
    """Combine file path + line content + secret into a single text document
    for TF-IDF vectorization. This is the NLP input to the model."""
    return f"{finding['file']} {finding['line']} {finding['secret']}"


def main() -> None:
    print("=== Secret Classifier Training ===")
    print()

    # 1. Generate dataset
    print("[1/4] Generating synthetic labelled dataset...")
    dataset = generate_dataset(n_samples=600)
    real_count = sum(1 for d in dataset if d["label"] == 1)
    fake_count = sum(1 for d in dataset if d["label"] == 0)
    print(f"      {len(dataset)} samples ({real_count} real, {fake_count} fixtures)")

    # Save dataset for inspection / auditing
    os.makedirs("ml", exist_ok=True)
    with open("ml/secret_classifier_dataset.json", "w") as f:
        json.dump(dataset, f, indent=2)
    print("      Saved dataset -> ml/secret_classifier_dataset.json")

    # 2. Build text features
    print("[2/4] Building TF-IDF feature vectors...")
    texts = [build_text_feature(d) for d in dataset]
    labels = [d["label"] for d in dataset]

    # 3. Train the pipeline
    print("[3/4] Training LogisticRegression classifier...")
    pipeline = Pipeline([
        ("tfidf", TfidfVectorizer(
            lowercase=True,
            token_pattern=r"(?u)\b\w+\b",
            ngram_range=(1, 2),
            min_df=1,
        )),
        ("clf", LogisticRegression(
            max_iter=1000,
            class_weight="balanced",
            random_state=42,
        )),
    ])
    pipeline.fit(texts, labels)

    # Quick training accuracy
    train_acc = pipeline.score(texts, labels)
    print(f"      Training accuracy: {train_acc:.1%}")

    # Show top features (what the model learned)
    feature_names = pipeline.named_steps["tfidf"].get_feature_names_out()
    coefficients = pipeline.named_steps["clf"].coef_[0]
    top_real = sorted(zip(feature_names, coefficients), key=lambda x: x[1], reverse=True)[:10]
    top_fake = sorted(zip(feature_names, coefficients), key=lambda x: x[1])[:10]
    print()
    print("      Top tokens indicating REAL_LEAK (positive weights):")
    for name, coef in top_real:
        print(f"        {name:30s}  weight={coef:+.3f}")
    print()
    print("      Top tokens indicating TEST_FIXTURE (negative weights):")
    for name, coef in top_fake:
        print(f"        {name:30s}  weight={coef:+.3f}")
    print()

    # 4. Serialize model
    print("[4/4] Serializing model...")
    model_path = "ml/secret_classifier_model.pkl"
    with open(model_path, "wb") as f:
        pickle.dump({
            "pipeline": pipeline,
            "label_map": {0: "TEST_FIXTURE", 1: "REAL_LEAK"},
            "feature_builder": build_text_feature,
            "training_accuracy": train_acc,
        }, f)
    print(f"      Saved model -> {model_path}")
    print()
    print("=== Training complete ===")


if __name__ == "__main__":
    main()