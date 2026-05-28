# บทที่ 23: Computer Use 101 — ให้ AI ขยับเมาส์ดูหน้าจอแทนคน

---

## 🪝 เมื่อไม่มี API ให้เรียก

ปลายปี 2025 — นายอาร์ต ต้องย้ายข้อมูลจากระบบ Legacy ที่บริษัทเก่าแก่มี 20 ปี ไปยังระบบใหม่

ปัญหา: ระบบ Legacy ไม่มี API ไม่มี CSV Export มีแค่ Web UI เก่าๆ ที่ต้องเข้าไปคลิกทีละ record

งาน: ย้ายข้อมูล 3,000 records → ใช้เวลาของมนุษย์ประมาณ 15 วันทำการ

อาร์ตลองใช้ **Computer Use** — ให้ Claude มองหน้าจอ แล้วคลิก พิมพ์ กรอกข้อมูล แทนตัวเอง

**ผลลัพธ์:** 3,000 records เสร็จใน 4 ชั่วโมง ที่ Claude ทำงานในขณะที่อาร์ตไปประชุม

---

## 🧠 Computer Use ทำงานอย่างไร

Computer Use ไม่ใช่ magic — มันเป็น loop ที่ทำซ้ำ:

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  1. Screenshot ─→ ส่งให้ Claude เห็นหน้าจอ                  │
│         ↓                                                   │
│  2. Claude วิเคราะห์ → ตัดสินใจว่าต้องทำอะไร               │
│         ↓                                                   │
│  3. Claude ส่ง Action:                                      │
│     • mouse_move(x, y)                                      │
│     • left_click(x, y)                                      │
│     • type("text to type")                                  │
│     • key("Enter")                                          │
│     • screenshot()  ← ดูผลลัพธ์                             │
│         ↓                                                   │
│  4. Execute action จริงบนเครื่อง                             │
│         ↓                                                   │
│  5. Screenshot ใหม่ → กลับไปข้อ 1                            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**สำคัญ:** Claude ไม่ได้ควบคุมเครื่องโดยตรง — มันแค่บอกว่าต้องการทำอะไร โค้ดของคุณ execute จริง

---

## ⚖️ Computer Use vs Tool Use — เลือกอะไร?

```
┌──────────────────┬─────────────────────┬───────────────────────┐
│                  │   Tool Use (API)    │   Computer Use (UI)   │
├──────────────────┼─────────────────────┼───────────────────────┤
│ ความเร็ว         │ เร็วมาก (~ms)       │ ช้ากว่า (~วินาที/step)│
│ ความแม่นยำ       │ สูงมาก (structured) │ ปานกลาง (pixel-based) │
│ ต้องการ API      │ ✅ ต้องมี API       │ ❌ ไม่ต้องมี API      │
│ Setup            │ เขียน code          │ แค่ screenshot        │
│ ต้นทุน           │ ต่ำกว่า             │ สูงกว่า (token/step)  │
│ Use case         │ Production pipelines│ Legacy systems, UI test│
└──────────────────┴─────────────────────┴───────────────────────┘

กฎ: ถ้ามี API → ใช้ Tool Use
    ถ้าไม่มี API → ใช้ Computer Use
```

---

## 🔧 Setup: Computer Use ต้องการอะไร

```bash
# ต้องการ:
# 1. Library สำหรับ screenshot
pip install pillow

# 2. Library สำหรับ control mouse/keyboard
pip install pyautogui   # Windows/Mac/Linux

# หรือ
pip install playwright  # สำหรับ browser automation

# 3. Anthropic SDK
pip install anthropic
```

```python
# src/computer_use/screenshot.py
import subprocess
import base64
from PIL import ImageGrab  # Windows/Mac

def take_screenshot() -> str:
    """ถ่าย screenshot และ return เป็น base64"""
    screenshot = ImageGrab.grab()
    
    # Resize ถ้าหน้าจอใหญ่เกินไป (ลด token)
    max_width = 1366
    if screenshot.width > max_width:
        ratio = max_width / screenshot.width
        new_height = int(screenshot.height * ratio)
        screenshot = screenshot.resize((max_width, new_height))
    
    import io
    buffer = io.BytesIO()
    screenshot.save(buffer, format='PNG')
    return base64.standard_b64encode(buffer.getvalue()).decode()
```

---

## 💻 Computer Use Agent: Core Implementation

```python
# src/computer_use/agent.py
import anthropic
import pyautogui
import time
from screenshot import take_screenshot

client = anthropic.Anthropic()

# Tool definitions สำหรับ Computer Use
COMPUTER_TOOLS = [
    {
        "type": "computer_20241022",
        "name": "computer",
        "display_width_px": 1366,
        "display_height_px": 768,
        "display_number": 1,
    }
]

def execute_action(action: dict) -> str:
    """Execute computer action จาก Claude"""
    action_type = action.get("action")
    
    if action_type == "screenshot":
        return take_screenshot()
    
    elif action_type == "mouse_move":
        x, y = action["coordinate"]
        pyautogui.moveTo(x, y, duration=0.3)
        return "moved"
    
    elif action_type == "left_click":
        x, y = action["coordinate"]
        pyautogui.click(x, y)
        time.sleep(0.5)  # รอให้ UI ตอบสนอง
        return "clicked"
    
    elif action_type == "right_click":
        x, y = action["coordinate"]
        pyautogui.rightClick(x, y)
        return "right_clicked"
    
    elif action_type == "double_click":
        x, y = action["coordinate"]
        pyautogui.doubleClick(x, y)
        return "double_clicked"
    
    elif action_type == "type":
        text = action.get("text", "")
        pyautogui.typewrite(text, interval=0.05)
        return "typed"
    
    elif action_type == "key":
        key = action.get("text", "")
        # แปลง key names
        key_map = {
            "Return": "enter", "Tab": "tab",
            "ctrl+a": "ctrl+a", "ctrl+c": "ctrl+c",
            "ctrl+v": "ctrl+v", "Escape": "escape",
        }
        pyautogui.hotkey(*key_map.get(key, key).split('+'))
        return "key_pressed"
    
    elif action_type == "scroll":
        x, y = action["coordinate"]
        direction = action.get("direction", "down")
        amount = action.get("amount", 3)
        if direction == "down":
            pyautogui.scroll(-amount, x=x, y=y)
        else:
            pyautogui.scroll(amount, x=x, y=y)
        return "scrolled"
    
    return f"unknown action: {action_type}"


def run_computer_agent(task: str, max_steps: int = 50) -> str:
    """Run Computer Use Agent สำหรับ task ที่กำหนด"""
    
    print(f"🤖 Starting Computer Use Agent")
    print(f"📋 Task: {task}\n")
    
    messages = []
    
    # เริ่มด้วย screenshot ปัจจุบัน
    initial_screenshot = take_screenshot()
    messages.append({
        "role": "user",
        "content": [
            {
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": "image/png",
                    "data": initial_screenshot,
                }
            },
            {
                "type": "text",
                "text": f"นี่คือหน้าจอปัจจุบัน ทำงานต่อไปนี้ให้เสร็จ:\n\n{task}\n\nบอกทุกขั้นตอนที่ทำ"
            }
        ]
    })
    
    for step in range(max_steps):
        print(f"Step {step + 1}/{max_steps}...")
        
        response = client.messages.create(
            model="claude-opus-4-5",  # Computer Use ต้องใช้ Opus
            max_tokens=4096,
            tools=COMPUTER_TOOLS,
            messages=messages,
        )
        
        # ถ้า Claude ตอบธรรมดา (งานเสร็จ)
        if response.stop_reason == "end_turn":
            final_text = next(
                (b.text for b in response.content if hasattr(b, 'text')),
                "Task completed"
            )
            print(f"\n✅ Done: {final_text}")
            return final_text
        
        # เพิ่ม assistant response
        messages.append({"role": "assistant", "content": response.content})
        
        # Execute tool calls
        tool_results = []
        
        for block in response.content:
            if block.type != "tool_use":
                if hasattr(block, 'text'):
                    print(f"  💬 Claude: {block.text[:100]}...")
                continue
            
            if block.name == "computer":
                action = block.input
                print(f"  🖱️  Action: {action.get('action')} {action.get('coordinate', '')}")
                
                if action.get("action") == "screenshot":
                    # ถ่าย screenshot ใหม่
                    new_screenshot = take_screenshot()
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": [
                            {
                                "type": "image",
                                "source": {
                                    "type": "base64",
                                    "media_type": "image/png",
                                    "data": new_screenshot,
                                }
                            }
                        ]
                    })
                else:
                    # Execute action
                    result = execute_action(action)
                    time.sleep(0.5)  # รอ UI
                    
                    # ถ่าย screenshot หลัง action
                    new_screenshot = take_screenshot()
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": [
                            {
                                "type": "image",
                                "source": {
                                    "type": "base64",
                                    "media_type": "image/png",
                                    "data": new_screenshot,
                                }
                            }
                        ]
                    })
        
        if tool_results:
            messages.append({"role": "user", "content": tool_results})
    
    return "Max steps reached"
```

---

## 🎯 ตัวอย่างจริง: Data Migration จาก Legacy Web UI

```python
# migrate_data.py
from agent import run_computer_agent

MIGRATION_TASK = """
ทำการย้ายข้อมูลจากระบบ Legacy (เปิดอยู่ใน browser) ไปยัง Excel:

1. ดูหน้า list ที่เปิดอยู่
2. คลิก record แรกในตาราง
3. copy ข้อมูลต่อไปนี้จากหน้า detail:
   - ชื่อลูกค้า
   - หมายเลขสัญญา
   - วันที่เริ่มต้น
   - มูลค่า
4. Switch ไปที่ Excel ที่เปิดอยู่
5. วาง (paste) ข้อมูลในแถวถัดไป
6. กลับมา browser
7. คลิก "Back" แล้วทำ record ถัดไป
8. ทำซ้ำจนครบ 3,000 records

ถ้าเจอ error popup ให้ปิด แล้วทำต่อ
ถ้าหน้า load นานเกิน 10 วินาที ให้ refresh"""

# รัน agent
result = run_computer_agent(MIGRATION_TASK, max_steps=300)
print(f"Result: {result}")
```

---

## 🌐 Browser Automation (Playwright Version)

สำหรับ Web automation โดยเฉพาะ ใช้ Playwright แทน pyautogui:

```python
# browser_agent.py — สำหรับ web-only tasks
from playwright.sync_api import sync_playwright
import anthropic
import base64

def run_browser_agent(task: str, start_url: str):
    client = anthropic.Anthropic()
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        page = browser.new_page(viewport={"width": 1366, "height": 768})
        page.goto(start_url)
        page.wait_for_load_state('networkidle')
        
        messages = []
        
        def get_screenshot() -> str:
            screenshot_bytes = page.screenshot()
            return base64.standard_b64encode(screenshot_bytes).decode()
        
        # Initial screenshot
        messages.append({
            "role": "user",
            "content": [
                {"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": get_screenshot()}},
                {"type": "text", "text": f"ทำงานต่อไปนี้:\n{task}"}
            ]
        })
        
        for _ in range(100):
            response = client.messages.create(
                model="claude-opus-4-5",
                max_tokens=4096,
                tools=[{"type": "computer_20241022", "name": "computer", "display_width_px": 1366, "display_height_px": 768}],
                messages=messages,
            )
            
            if response.stop_reason == "end_turn":
                break
            
            messages.append({"role": "assistant", "content": response.content})
            tool_results = []
            
            for block in response.content:
                if block.type != "tool_use":
                    continue
                
                action = block.input
                action_type = action.get("action")
                
                if action_type == "screenshot":
                    pass  # จะถ่ายหลังทุก action อยู่แล้ว
                elif action_type == "left_click":
                    x, y = action["coordinate"]
                    page.mouse.click(x, y)
                    page.wait_for_timeout(500)
                elif action_type == "type":
                    page.keyboard.type(action["text"])
                elif action_type == "key":
                    page.keyboard.press(action["text"])
                elif action_type == "scroll":
                    x, y = action["coordinate"]
                    page.mouse.wheel(0, 100 if action.get("direction") == "down" else -100)
                
                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": [{"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": get_screenshot()}}]
                })
            
            if tool_results:
                messages.append({"role": "user", "content": tool_results})
        
        browser.close()
```

---

## 🛡️ Safety สำหรับ Computer Use

```python
# ❌ อันตราย: ให้ Claude ทำได้ทุกอย่าง
run_computer_agent("ลบไฟล์เก่าๆ ออก")

# ✅ ปลอดภัย: จำกัด scope ชัดเจน
SAFE_TASK = """
เปิดเฉพาะ browser Chrome ที่มี tab ชื่อ 'Legacy System'
ห้ามเปิดแอปอื่น ห้ามกดที่นอก browser
ถ้าเห็น confirmation dialog ที่ไม่ใช่เรื่อง data migration → STOP ทันที
ถ้าไม่แน่ใจ → STOP และรายงานสิ่งที่เห็น"""

# เพิ่ม Human Checkpoint ทุก N steps
def run_with_checkpoints(task: str, checkpoint_every: int = 20):
    """หยุดรอ human approve ทุก N steps"""
    steps = 0
    # ... implement ใน production จริง
```

---

## 🎯 สรุปบทที่ 23

| หัวข้อ | สิ่งที่ต้องจำ |
|--------|--------------|
| ใช้เมื่อไหร่ | ไม่มี API → ใช้ Computer Use |
| ใช้แทนอะไรไม่ได้ | มี API → ใช้ Tool Use ดีกว่าเสมอ |
| Model | ต้องใช้ claude-opus-4-5 |
| Loop | Screenshot → Analyze → Action → Screenshot |
| Tools | `computer_20241022` type |
| Actions | screenshot, mouse_move, left_click, type, key, scroll |
| Safety | จำกัด scope ในงาน, checkpoint ทุก N steps |

---

## 📋 Action Items ก่อนไปบทที่ 24

- [ ] ติดตั้ง pyautogui หรือ playwright
- [ ] ทดสอบ `take_screenshot()` ว่า capture ได้ถูกต้อง
- [ ] รัน agent กับ task ง่ายๆ เช่น "เปิด Notepad แล้วพิมพ์ Hello"
- [ ] สังเกต token usage ต่อ step (Computer Use แพงกว่า Tool Use ~10x)
- [ ] ระบุ use cases ในงานที่ไม่มี API ให้ Computer Use ช่วย

---

*ใน **บทที่ 24** เราได้เรียนรู้แล้วว่า Claude Vision API สามารถอ่าน Figma mockup และ generate Design System ได้ ซึ่งทำให้ Frontend Developer ประหยัดเวลาได้หลายชั่วโมงต่อ sprint ครับ*
