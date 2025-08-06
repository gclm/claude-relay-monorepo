"""
路由配置管理器
直接操作 KV 存储切换路由配置
"""

import json
import os
from pathlib import Path
from typing import Dict, Any, Optional

class RouteManager:
    def __init__(self, kv_storage_path: str = "../../.kv-storage"):
        self.kv_path = Path(kv_storage_path).resolve()
        self.config_file = self.kv_path / "admin_selected_config.json"
        
    def get_current_route(self) -> Optional[Dict[str, Any]]:
        """获取当前活动的路由配置"""
        try:
            if self.config_file.exists():
                with open(self.config_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            return None
        except Exception as e:
            print(f"读取当前路由配置失败: {e}")
            return None
    
    def switch_route(self, route_id: str) -> bool:
        """切换到指定的路由配置"""
        try:
            config = {
                "type": "route",
                "routeId": route_id
            }
            
            with open(self.config_file, 'w', encoding='utf-8') as f:
                json.dump(config, f, indent=2, ensure_ascii=False)
            
            print(f"✅ 已切换到路由配置: {route_id}")
            return True
            
        except Exception as e:
            print(f"❌ 切换路由配置失败: {e}")
            return False
    
    def get_available_routes(self) -> Dict[str, Any]:
        """获取所有可用的路由配置"""
        routes_file = self.kv_path / "admin_route_configs.json"
        
        try:
            if routes_file.exists():
                with open(routes_file, 'r', encoding='utf-8') as f:
                    routes = json.load(f)
                return {route['id']: route for route in routes}
            return {}
        except Exception as e:
            print(f"读取路由配置失败: {e}")
            return {}
    
    def get_providers(self) -> Dict[str, Any]:
        """获取所有供应商配置"""
        providers_file = self.kv_path / "admin_model_providers.json"
        
        try:
            if providers_file.exists():
                with open(providers_file, 'r', encoding='utf-8') as f:
                    providers = json.load(f)
                return {provider['id']: provider for provider in providers}
            return {}
        except Exception as e:
            print(f"读取供应商配置失败: {e}")
            return {}
    
    def show_route_info(self, route_id: str = None):
        """显示路由配置信息"""
        if route_id is None:
            current = self.get_current_route()
            route_id = current.get('routeId') if current else None
        
        if not route_id:
            print("❌ 没有活动的路由配置")
            return
        
        routes = self.get_available_routes()
        providers = self.get_providers()
        
        if route_id not in routes:
            print(f"❌ 路由配置 {route_id} 不存在")
            return
        
        route = routes[route_id]
        
        print(f"📋 路由配置信息:")
        print(f"   ID: {route['id']}")
        print(f"   名称: {route['name']}")
        print(f"   描述: {route.get('description', 'N/A')}")
        print(f"   创建时间: {route.get('createdAt', 'N/A')}")
        print()
        
        print("🔀 路由规则:")
        rules = route.get('rules', {})
        for rule_name, rule_config in rules.items():
            provider_id = rule_config.get('providerId')
            model = rule_config.get('model')
            
            provider_name = "未知供应商"
            if provider_id in providers:
                provider_name = providers[provider_id]['name']
            
            print(f"   {rule_name}: {provider_name} -> {model}")
    
    def quick_switch(self, route_type: str):
        """快速切换路由类型"""
        route_mappings = {
            "gemini": "1754309894180",      # 切换到 Gemini 路由
            "openai": "1754395690057",      # 切换到 OpenAI 路由  
            "mixed": "1754395690057"        # 混合路由（使用 OpenAI 配置但有多规则）
        }
        
        if route_type in route_mappings:
            route_id = route_mappings[route_type]
            success = self.switch_route(route_id)
            if success:
                self.show_route_info(route_id)
            return success
        else:
            print(f"❌ 不支持的路由类型: {route_type}")
            print(f"   支持的类型: {list(route_mappings.keys())}")
            return False