"""
Claude Relay 测试客户端
简洁直观的测试工具，支持路由切换和场景测试
"""

import json
import time
import requests
from typing import Dict, Any, List, Optional
from rich.console import Console
from rich.table import Table

console = Console()

class ClaudeRelayTestClient:
    def __init__(self, base_url: str = "http://localhost:8787"):
        self.base_url = base_url
        self.session = requests.Session()
        self.session.headers.update({
            "Content-Type": "application/json"
        })
    
    def test_health(self) -> bool:
        """测试服务健康状态"""
        try:
            response = self.session.get(f"{self.base_url}/v1/health")
            return response.status_code == 200
        except:
            return False
    
    def send_message(self, prompt: str, **kwargs) -> Dict[str, Any]:
        """发送消息并返回结果"""
        
        request_data = {
            "model": "claude-3-5-sonnet-20241022",
            "messages": [
                {
                    "role": "user", 
                    "content": prompt
                }
            ],
            **kwargs
        }
        
        start_time = time.time()
        
        try:
            response = self.session.post(
                f"{self.base_url}/v1/messages",
                json=request_data,
                timeout=60
            )
            
            response_time = time.time() - start_time
            
            if response.status_code == 200:
                if 'text/event-stream' in response.headers.get('content-type', ''):
                    # 流式响应
                    return {
                        "success": True,
                        "type": "stream",
                        "content": self._parse_stream(response.text),
                        "response_time": response_time,
                        "raw_response": response.text
                    }
                else:
                    # 普通响应
                    data = response.json()
                    return {
                        "success": True,
                        "type": "normal", 
                        "content": self._extract_content(data),
                        "response_time": response_time,
                        "raw_response": data
                    }
            else:
                return {
                    "success": False,
                    "error": f"HTTP {response.status_code}: {response.text}",
                    "response_time": response_time
                }
                
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "response_time": time.time() - start_time
            }
    
    def _extract_content(self, response_data: Dict) -> str:
        """提取响应内容"""
        if isinstance(response_data.get('content'), list):
            text_parts = []
            for item in response_data['content']:
                if item.get('type') == 'text':
                    text_parts.append(item.get('text', ''))
            return '\n'.join(text_parts)
        return str(response_data.get('content', ''))
    
    def _parse_stream(self, stream_text: str) -> str:
        """解析流式响应"""
        lines = stream_text.strip().split('\n')
        content_parts = []
        
        for line in lines:
            if line.startswith('data: '):
                try:
                    data = json.loads(line[6:])
                    if data.get('type') == 'content_block_delta':
                        delta = data.get('delta', {})
                        if delta.get('type') == 'text_delta':
                            content_parts.append(delta.get('text', ''))
                except:
                    continue
        
        return ''.join(content_parts)
    
    def run_scenario(self, scenario: Dict[str, Any]) -> Dict[str, Any]:
        """运行单个测试场景"""
        console.print(f"🧪 测试场景: [bold]{scenario['name']}[/bold]")
        
        # 准备请求参数
        kwargs = {}
        if scenario.get('stream'):
            kwargs['stream'] = True
        if scenario.get('tools'):
            kwargs['tools'] = scenario['tools']
            
        # 发送请求
        result = self.send_message(scenario['prompt'], **kwargs)
        
        # 验证结果
        if result['success']:
            validation = self._validate_response(result, scenario)
            result['validation'] = validation
            
            # 显示结果
            if validation['passed']:
                console.print("✅ [green]测试通过[/green]")
            else:
                console.print("❌ [red]测试失败[/red]")
                console.print(f"   失败原因: {validation['reason']}")
        else:
            console.print(f"❌ [red]请求失败: {result['error']}[/red]")
        
        console.print(f"⏱️  响应时间: {result['response_time']:.2f}s")
        console.print("=" * 50)
        
        return result
    
    def _validate_response(self, result: Dict, scenario: Dict) -> Dict[str, Any]:
        """验证响应结果"""
        content = result.get('content', '').lower()
        keywords = scenario.get('keywords', [])
        
        # 检查关键词
        missing_keywords = [kw for kw in keywords if kw.lower() not in content]
        
        if missing_keywords:
            return {
                "passed": False,
                "reason": f"缺少关键词: {missing_keywords}",
                "found_keywords": [kw for kw in keywords if kw.lower() in content],
                "missing_keywords": missing_keywords
            }
        
        return {
            "passed": True,
            "reason": "所有验证通过",
            "found_keywords": keywords,
            "missing_keywords": []
        }
    
    def run_batch_scenarios(self, scenarios: List[Dict]) -> List[Dict]:
        """批量运行测试场景"""
        results = []
        
        console.print(f"🚀 开始执行 {len(scenarios)} 个测试场景")
        
        for i, scenario in enumerate(scenarios, 1):
            console.print(f"📋 [{i}/{len(scenarios)}] 执行中...")
            result = self.run_scenario(scenario)
            results.append({
                "scenario": scenario,
                "result": result
            })
        
        return results
    
    def generate_report(self, results: List[Dict]) -> Dict[str, Any]:
        """生成测试报告"""
        total = len(results)
        passed = sum(1 for r in results if r['result']['success'] and r['result'].get('validation', {}).get('passed', False))
        failed = total - passed
        
        avg_response_time = sum(r['result']['response_time'] for r in results) / total if total > 0 else 0
        
        # 创建汇总表格
        table = Table(title="测试结果汇总", show_header=True)
        table.add_column("指标", style="cyan")
        table.add_column("数值", style="green")
        
        table.add_row("总测试数", str(total))
        table.add_row("通过数", str(passed))
        table.add_row("失败数", str(failed))
        table.add_row("通过率", f"{passed/total*100:.1f}%" if total > 0 else "0%")
        table.add_row("平均响应时间", f"{avg_response_time:.2f}s")
        
        console.print(table)
        
        return {
            "summary": {
                "total": total,
                "passed": passed, 
                "failed": failed,
                "pass_rate": passed/total*100 if total > 0 else 0,
                "avg_response_time": avg_response_time
            },
            "details": results
        }