import urllib.request
import urllib.parse
import json

url = "http://127.0.0.1:8000/api/extract"

# Build multipart form data manually using standard library
boundary = "===Boundary==="
data = []
data.append(f"--{boundary}")
data.append('Content-Disposition: form-data; name="file"; filename="test_report.txt"')
data.append("Content-Type: text/plain")
data.append("")
data.append("Patient: Sarah Connor\nHemoglobin: 13.5 g/dL\nWBC Count: 5500\nPlatelets: 220000")
data.append(f"--{boundary}--")
data.append("")
payload = "\r\n".join(data).encode("utf-8")

req = urllib.request.Request(url, data=payload)
req.add_header("Content-Type", f"multipart/form-data; boundary={boundary}")

print(f"Sending test POST to local server endpoint: {url} ...")
try:
    with urllib.request.urlopen(req) as resp:
        print(f"Response status code: {resp.getcode()}")
        print("Response body:")
        print(resp.read().decode("utf-8"))
except Exception as e:
    print(f"Error: {e}")

