#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build_single_file.py
Sprite Animator 单文件独立脱机便携化构建脚本
将 HTML、CSS 样式表、第三方 Vendor 库与所有核心 JS 模块内联合并为单一的 SpriteAnimator.html
零外部网络依赖，双击即可直接在任意现代浏览器脱机离线运行。
"""

import os
import re
import sys
from pathlib import Path

# 项目根目录
BASE_DIR = Path(__file__).resolve().parent

# JS 模块按依赖拓扑顺序内联合并列表
MODULE_FILES = [
    BASE_DIR / "js" / "vendor" / "jszip.min.js",
    BASE_DIR / "js" / "vendor" / "gifshot.min.js",
    BASE_DIR / "js" / "core" / "state.js",
    BASE_DIR / "js" / "core" / "image-processor.js",
    BASE_DIR / "js" / "core" / "overlap-isolator.js",
    BASE_DIR / "js" / "core" / "frame-alignment.js",
    BASE_DIR / "js" / "core" / "animation-player.js",
    BASE_DIR / "js" / "core" / "snap-guides.js",
    BASE_DIR / "js" / "core" / "canvas-workspace.js",
    BASE_DIR / "js" / "core" / "gif-decoder.js",
    BASE_DIR / "js" / "core" / "exporter.js",
    BASE_DIR / "js" / "app.js",
]

# Windows 控制台编码保护
if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

def clean_es6_modules(code: str, filename: str) -> str:
    """
    将 ES6 Module 代码转换为适合单体内联执行的代码：
    1. 移除 import 声明
    2. 移除 export default 与命名导出 export { ... }
    3. 将 export const/function/class 转换为声明
    """
    # 移除多行或单行 import 语句: import ... from '...'; 或 import '...';
    code = re.sub(r'import\s+[\s\S]*?from\s+[\'"][^\'"]+[\'"];?', '', code)
    code = re.sub(r'import\s+[\'"][^\'"]+[\'"];?', '', code)

    # 移除 export default 语句 (如 export default Exporter; 或 export default class ...)
    code = re.sub(r'export\s+default\s+class\b', 'class', code)
    code = re.sub(r'export\s+default\s+function\b', 'function', code)
    code = re.sub(r'export\s+default\s+[a-zA-Z0-9_$]+;?', '', code)

    # 移除 export { a, b, c }; 命名聚合导出
    code = re.sub(r'export\s*\{[\s\S]*?\};?', '', code)

    # 将具名导出修饰符转换为普通声明: export const -> const, export class -> class
    code = re.sub(r'export\s+(const|let|var|function|class|async\s+function)\b', r'\1', code)

    return code.strip()

def build_single_file(output_path: Path):
    print("=" * 60)
    print("🚀 开始构建 Sprite Animator 单文件独立发行版本")
    print("=" * 60)

    index_html_path = BASE_DIR / "index.html"
    if not index_html_path.exists():
        print(f"❌ 错误: 未找到入口模板文件: {index_html_path}")
        sys.exit(1)

    with open(index_html_path, "r", encoding="utf-8") as f:
        html_content = f.read()

    # 1. 内联合并 CSS 样式表
    css_links = re.findall(r'<link\s+rel=[\'"]stylesheet[\'"]\s+href=[\'"]([^\'"]+)[\'"]\s*/?>', html_content)
    for css_rel in css_links:
        css_full = BASE_DIR / css_rel
        if css_full.exists():
            with open(css_full, "r", encoding="utf-8") as cf:
                css_text = cf.read()
            replacement = f"<style>\n/* 内联样式表: {css_rel} */\n{css_text}\n</style>"
            # 替换该 link 标签
            pattern = re.compile(rf'<link\s+rel=[\'"]stylesheet[\'"]\s+href=[\'"]{re.escape(css_rel)}[\'"]\s*/?>')
            html_content = pattern.sub(replacement, html_content)
            print(f"  ✔ 成功内联 CSS: {css_rel} ({len(css_text.encode('utf-8')) / 1024:.1f} KB)")
        else:
            print(f"  ⚠ 警告: CSS 文件未找到: {css_full}")

    # 2. 依次读取并内联 JS 模块
    combined_js_parts = []
    combined_js_parts.append("/**\n * Sprite Animator - All-in-One Self-Contained Bundle\n * Generated automatically by build_single_file.py\n */\n")
    combined_js_parts.append("(function() {\n'use strict';\n")

    total_js_size = 0
    for mod_path in MODULE_FILES:
        if not mod_path.exists():
            print(f"❌ 错误: 核心模块未找到: {mod_path}")
            sys.exit(1)

        with open(mod_path, "r", encoding="utf-8") as jf:
            raw_code = jf.read()

        size_kb = len(raw_code.encode("utf-8")) / 1024
        total_js_size += size_kb
        rel_name = mod_path.relative_to(BASE_DIR)
        rel_str = str(rel_name).replace('\\', '/')
        print(f"  ✔ 打包模块: {rel_str:<32} ({size_kb:>5.1f} KB)")

        cleaned_code = clean_es6_modules(raw_code, mod_path.name)
        combined_js_parts.append(f"\n// ==========================================\n// 模块: {rel_name}\n// ==========================================\n")
        combined_js_parts.append(cleaned_code)
        combined_js_parts.append("\n")

    combined_js_parts.append("\n})();\n")
    final_js_bundle = "".join(combined_js_parts)

    # 3. 移除 HTML 中原有的所有外部脚本标签并注入统一脚本块
    # 匹配所有的 <script ... src="..."></script>
    script_pattern = re.compile(r'<script\s+[^>]*src=[\'"][^\'"]+[\'"][^>]*>\s*</script>', re.IGNORECASE)
    html_without_scripts = script_pattern.sub('', html_content)

    # 注入单体内联脚本
    bundle_script_tag = f"<script>\n{final_js_bundle}\n</script>"
    
    # 插入到 </body> 之前
    if "</body>" in html_without_scripts:
        final_html = html_without_scripts.replace("</body>", f"{bundle_script_tag}\n</body>")
    else:
        final_html = html_without_scripts + "\n" + bundle_script_tag

    # 4. 写入输出文件
    with open(output_path, "w", encoding="utf-8") as out_f:
        out_f.write(final_html)

    output_size_kb = output_path.stat().st_size / 1024

    print("=" * 60)
    print(f"🎉 单文件打包构建完成！")
    print(f"  输出文件: {output_path.name}")
    print(f"  绝对路径: {output_path}")
    print(f"  文件大小: {output_size_kb:.1f} KB (内联合并全部 HTML, CSS, JS 与算法库)")
    print(f"  网络依赖: 0 (完全脱机离线可用，双击即可秒级打开使用)")
    print("=" * 60)

if __name__ == "__main__":
    output_target = BASE_DIR / "SpriteAnimator.html"
    build_single_file(output_target)
