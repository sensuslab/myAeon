"""Synthetic subprocess behavior for bridge lifecycle tests."""
import json
import sys
import time

mode = json.load(sys.stdin)["mode"]
if mode == "hang":
    time.sleep(5)
elif mode == "malformed":
    print("invalid JSON")
    sys.exit(0)
elif mode == "fail":
    sys.exit(1)
elif mode == "huge":
    print("x" * 10000)
    sys.exit(0)
print(json.dumps({"status": "OK", "data": {"offline": True}}))
