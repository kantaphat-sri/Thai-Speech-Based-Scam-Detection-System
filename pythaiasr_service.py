from flask import Flask, request, jsonify
import time
import random

app = Flask(__name__)

# Simulated speech-to-text outputs
MOCK_TRANSCRIPTS = [
    "คุณต้องโอนเงิน 50000 บาทภายใน 10 นาทีไม่งั้นบัญชีถูกระงับ",
    "นี่คือตำรวจไซเบอร์ คุณต้องให้ข้อมูลบัญชีธนาคารด่วนมาก",
    "กรุณาบอกรหัส OTP ตอนนี้เพื่อยืนยันบัญชี",
    "สวัสดีครับ คุณสะดวกคุยตอนบ่ายสามได้ไหมครับ",
    "วันนี้ไปทบทวนวิชา OS ด้วยกันไหม"
]

@app.route('/transcribe', methods=['POST'])
def transcribe():
    if 'audio' not in request.files:
        return jsonify({"error": "No audio file provided"}), 400
    
    # Simulate ASR processing time (1.5 to 3 seconds) 
    # This perfectly demonstrates that your Node.js event loop doesn't block!
    time.sleep(random.uniform(1.5, 3.0))

    # Return a random mock transcript
    mock_text = random.choice(MOCK_TRANSCRIPTS)
    
    return jsonify({"transcript": mock_text})

if __name__ == '__main__':
    print("==========================================================")
    print("Starting MOCK PyThaiASR sidecar service on port 5001")
    print("NOTE: Because your system's Python cannot install PyTorch ")
    print("due to OS limits, this service will return fake transcripts")
    print("so you can successfully test your JS pipeline & file upload!")
    print("==========================================================")
    app.run(port=5001, debug=False)
