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
