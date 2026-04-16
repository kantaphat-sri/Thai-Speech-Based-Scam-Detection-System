Thai Scam Detector - Project Overview

This document explains the architecture, the purpose of each file, how the methods work internally, and provides a guide on how to conceptualize and write these files. This project was developed as part of ITCS225 to demonstrate practical applications of Operating Systems concepts.

==============================================================
[ ENGLISH VERSION ]
==============================================================

==============================================================
A. Operating Systems Concepts Applied
==============================================================
1. Process & Thread Scheduling: A Round-Robin worker pool distributes CPU-bound DSP/NLP tasks across worker threads.
2. Memory Management: An LRU (Least Recently Used) cache is implemented to store past results, dramatically reducing latency and memory footprint.
3. Inter-Process Communication (IPC): A structured message-passing protocol allows the main thread to securely exchange Buffer data and JSON with worker threads without blocking.

==============================================================
B. Architecture & File Breakdown
==============================================================

1. server.js (The Entry Point & API Backend)
Lead Contributor: Tri Trisuthan (6788138)
How it works: Express server routing APIs and managing the LRU cache. It handles the non-blocking event loop.
Methods: getCachedResult, setCacheResult, /analyze, /transcribe, /analyze-audio.
How to write it: Set up Express routes, integrate Worker Pools via Promises, ensuring the main event loop isn't blocked.

2. thai_scam_detector.html (The Frontend UI)
Lead Contributor: Phon Akkaralwan (6788002)
How it works: Vanilla HTML/JS/CSS frontend bridging Web Speech API to the backend. Updates UI (Safe, Warning, Scam).
Methods: callAnalyzeAPI, runPipeline, renderVerdict.
How to write it: Map async endpoints to Client-side functions for non-blocking UI behavior.

3. pipeline/worker_manager.js (The Orchestrator / Thread Pool)
Lead Contributor: Siwakorn Sukhsaran (6788118)
How it works: Implements a Round-Robin scheduler limiting threads to `CPU cores - 1`.
Methods: init(), runTask() which forwards IPC messages to workers.
How to write it: Import node `worker_threads`, build an array of workers, and establish Promise mappings for task tracking.

4. pipeline/worker.js (The Heavy Lifter)
Lead Contributor: Sarun Intornphu (6788024)
How it works: Isolated thread processing 'ANALYZE_TEXT' or 'ANALYZE_TONE' sequentially.
Methods: parentPort.on('message') cascading to preprocessing and classification.
How to write it: Listen to IPC messages and emit `{status: 'success', result}` upon completion.

5. pipeline/preprocessor.js (Text Preprocessing)
Lead Contributor: Nutt Panwaewngam (6788080)
How it works: Normalizes data and circumvents Thai's lack of spacing by using a 3-character sliding window.
Methods: preprocess(), normalise(), tokenise(), clean().
How to write it: Iterate across `[\u0E00-\u0E7F]` ranges with windowing and standard array manipulation.

6. pipeline/extractor.js (Feature Extraction)
Lead Contributor: Nutt Panwaewngam (6788080)
How it works: Matches split tokens against scam dictionaries (OTP, Money, Urgency, Authority).
Methods: extractFeatures(), deduplicate().
How to write it: Store definitions in objects, use `new Set(tokens)` for fast O(1) matching.

7. pipeline/classifier.js (Risk Decision Engine)
Lead Contributor: Sarun Intornphu (6788024)
How it works: Basic threshold checking against the extracted risk score.
Methods: classify(score). (e.g. >= 60 Scam, > 35 Warning).
How to write it: Pure function checking numeric ranges isolated by constants.

8. pipeline/toneAnalyzer.js (Audio DSP)
Lead Contributor: Kantaphat Srisalatone (6788114)
How it works: Scans raw WAV arrays for pitch utilizing Autocorrelation, RMS amplitude, and jitter.
Methods: analyzeTone(), parsePcmFromWav(), extractAcousticFeatures(), estimatePitch().
How to write it: Read RIFF headers and apply computational DSP arrays in isolated threads.

9. pipeline/transcriber.js (ASR Service Stub)
Lead Contributor: Sarun Intornphu (6788024)
How it works: Stub for Voice-to-Text routing via PyThaiASR.
Methods: transcribeAudio(), forwardToAsrService().
How to write it: Build multipart 'fetch' requests pointed at external endpoints.

10. pipeline/combinedScorer.js (Data Aggregator)
Lead Contributor: Kodchaphan Nikom (6788069)
How it works: Merges Tone and Text weights (0.4 vs 0.6) into a consolidated final score.
Methods: combineScores(), explainResult().
How to write it: Weight aggregation math alongside string interpolation for human reasons.

==============================================================
C. Performance Results (Node.js vs Python)
==============================================================
- Cold Start: 3-8s (Python) vs ~200ms (Node.js)
- /analyze Latency: 2-5ms (Python) vs 0.3-0.8ms (Node JS + Worker)
- /transcribe Latency: 8-15ms vs 2-4ms
- Idle Memory: 180MB vs 35MB
Conclusion: The integration of worker pools and LRU caches drastically reduced server resources.

==============================================================
D. Group Members (ITCS225)
==============================================================
- 6788138 Tri Trisuthan
- 6788002 Phon Akkaralwan
- 6788080 Nutt Panwaewngam
- 6788069 Kodchaphan Nikom
- 6788114 Kantaphat Srisalatone
- 6788118 Siwakorn Sukhsaran
- 6788024 Sarun Intornphu


==============================================================
[ THAI TRANSLATION / ฉบับภาษาไทย ]
==============================================================

Thai Scam Detector - ภาพรวมของโปรเจกต์

เอกสารนี้อธิบายถึงสถาปัตยกรรมโปรเจกต์รายวิชา ITCS225 หน้าที่ของแต่ละไฟล์ วิธีการทำงานของฟังก์ชันต่างๆ และเป็นคู่มือสำหรับการพัฒนาโปรเจกต์ โดยมีการประยุกต์ใช้หลักการของระบบปฏิบัติการ (Operating Systems) ร่วมด้วย

==============================================================
A. แนวคิดระบบปฏิบัติการที่นำมาใช้
==============================================================
1. การจัดการ Process & Thread: สถาปัตยกรรม Worker Pool ทำงานแบบ Round-Robin ช่วยกระจายโหลดการประมวลผลให้ Worker มิต้องรบกวน Main Thread
2. การจัดการหน่วยความจำ: ประยุกต์ใช้ LRU Cache สำหรับเก็บผลลัพธ์ย้อนหลัง ช่วยประหยัดคอร์ประมวลผลและการใช้หน่วยความจำโดยรวม
3. การสื่อสารข้ามโปรเซส (IPC): สร้างโครงสร้างการส่งข้อมูลแบบ Message Protocol สื่อสารระหว่าง Thread อย่างเป็นระบบ

==============================================================
B. โครงสร้างไฟล์และการทำงาน
==============================================================

1. server.js
ผู้รับผิดชอบหลัก: Tri Trisuthan (6788138)
การทำงาน: เซิร์ฟเวอร์ Express สำหรับรับ API ข้อมูล และจัดการ Cache รองรับการทำงานแบบ non-blocking

2. thai_scam_detector.html
ผู้รับผิดชอบหลัก: Phon Akkaralwan (6788002)
การทำงาน: หน้าผู้ใช้งาน (UI) นำข้อมูลเข้าด้วยเสียง/คำ และอัปเดตผลลัพธ์กลับมาแสดงหน้าจอที่ให้สีแจ้งเตือน (แดง, เหลือง, เขียว)

3. pipeline/worker_manager.js
ผู้รับผิดชอบหลัก: Siwakorn Sukhsaran (6788118)
การทำงาน: เครื่องมือหลักที่จัดคิวงานแบบ Round-Robin ให้แก่ Worker Thread ที่สแปวน์ออกมาเท่ากับ จำนวน CPU - 1

4. pipeline/worker.js
ผู้รับผิดชอบหลัก: Sarun Intornphu (6788024)
การทำงาน: Thread รองที่แยกตัวออกมาประมวลผลหนักๆ เช่น NLP/DSP ไปจนจบตามคิว แล้วจัดการโยนผลลัพธ์กลับผ่าน IPC Message

5. pipeline/preprocessor.js
ผู้รับผิดชอบหลัก: Nutt Panwaewngam (6788080)
การทำงาน: เตรียมข้อมูลข้อความ ตัดคำภาษาไทยจากกลไกหน้าต่าง (sliding window) ขนาด 3 ตัวอักษร

6. pipeline/extractor.js
ผู้รับผิดชอบหลัก: Nutt Panwaewngam (6788080)
การทำงาน: นำคำที่หั่นแล้วมาวิเคราะห์จับคู่เพื่อประเมินหมวดหมู่ความเสี่ยง 4 รูปแบบหลัก 

7. pipeline/classifier.js
ผู้รับผิดชอบหลัก: Sarun Intornphu (6788024)
การทำงาน: ตัดสินความเสี่ยงผ่านเกณฑ์คะแนน (เช่น >=60 เป็น Scam, >35 เป็น Warning)

8. pipeline/toneAnalyzer.js
ผู้รับผิดชอบหลัก: Kantaphat Srisalatone (6788114)
การทำงาน: การทำโครงข่ายประเมินเสียงทางฟิสิกส์ DSP ค้นหาความเร็ว ความสั่นเครียด จากโมเดลคณิตศาสตร์ Autocorrelation

9. pipeline/transcriber.js
ผู้รับผิดชอบหลัก: Sarun Intornphu (6788024)
การทำงาน: ไฟล์รองสำหรับการเชื่อมโยงไปยังบริการ Speech to text อย่าง PyThaiASR 

10. pipeline/combinedScorer.js
ผู้รับผิดชอบหลัก: Kodchaphan Nikom (6788069)
การทำงาน: สมานและประเมินผลคะแนนระหว่างน้ำเสียง Tone ก้บ ข้อความ Text ร่วมกันเพื่อหาสรุปผลขั้นสุดท้าย

==============================================================
C. ผลการทดสอบประสิทธิภาพ
==============================================================
เปรียบเทียบการพัฒนาด้วย Python และ Node.js (พร้อมตัวปรับแต่ง Worker Pool และ Caching):
- หน่วงเวลาหน้าระบบ (Cold Start): ใช้เพียงไม่เกิน ~200ms ใน Node เทียบกับ 3-8 วินาทีจากแนวคิดเริ่มแรกด้วย Python
- ความล่าช้า API: จาก 2-5ms เหลือเพียงเสี้ยววินาที 0.3-0.8ms ในส่วน /analyze และประสิทธิภาพการรับคำสั่งเพิ่มขึ้นหลายเท่า
- ทรัพยากรหน่วยความจำ: ลดจาก 180MB เหลือเพียงแค่ 35-50MB ในสถานะ Idle

==============================================================
D. สมาชิกในกลุ่ม (วิชา ITCS225)
==============================================================
- 6788138 ตรี ตรีสุทธรรณ (Tri Trisuthan)
- 6788002 ภณ อัครหล่อวรรณ (Phon Akkaralwan)
- 6788080 ณัฐ ปานแววงาม (Nutt Panwaewngam)
- 6788069 กชพรรณ นิคม (Kodchaphan Nikom)
- 6788114 กันตพัฒน์ ศรีสาลาโทน (Kantaphat Srisalatone)
- 6788118 ศิวกร สุขสราญ (Siwakorn Sukhsaran)
- 6788024 ศรัณย์ อินทรภู (Sarun Intornphu)
