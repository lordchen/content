#!/usr/bin/env python3

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path


def main() -> int:
    output_dir = Path("data/generated/manual_script_library")
    output_dir.mkdir(parents=True, exist_ok=True)
    created_at = datetime.now(timezone.utc).isoformat()
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")

    scripts = [
        {
            "id": 1,
            "title": "夏天就要 Seawalk，能不能改成商场球鞋上脚视频",
            "hook": "最近大家都在晒夏天状态和出门感，这种热词能不能直接转成一条球鞋上脚短视频？",
            "outline": [
                "开头直接说夏天逛街最怕鞋子闷、穿搭没精神。",
                "中段切到阿迪达斯门店里一双适合夏天通勤或出街的鞋。",
                "最后带到门店活动或到店优惠，给出明确到店理由。"
            ],
            "source_basis": {
                "trend": "夏天就要Seawalk",
                "category": "球鞋 / 穿搭 / 门店优惠",
                "benchmark_pattern": "球鞋上脚 + 场景种草"
            },
            "fit_reason": "热点偏生活方式，不敏感，容易自然嫁接到夏日穿搭和门店到店场景。",
            "risk_notes": "不要强行解释 Seawalk 本身含义，重点借“夏天出门状态”这个情绪壳。",
            "platform": "抖音",
            "duration_seconds": 15
        },
        {
            "id": 2,
            "title": "哈兰德入驻抖音，能不能改成门店里的足球风格穿搭推荐",
            "hook": "哈兰德这种体育明星热点，最适合转成一条‘今天店里最有球感的一套穿搭’。",
            "outline": [
                "开头用一句大家都在刷哈兰德，但普通人真正能抄的是穿搭状态。",
                "中段展示一套门店里偏足球感、运动感的搭配。",
                "结尾落到门店活动或限时到店优惠。"
            ],
            "source_basis": {
                "trend": "哈兰德入驻抖音",
                "category": "服装 / 穿搭 / 门店活动",
                "benchmark_pattern": "热点嫁接 + 穿搭推荐"
            },
            "fit_reason": "品牌和运动主题强相关，能借势但不需要碰明星肖像或搬运内容。",
            "risk_notes": "不要直接使用明星素材，不要做未经授权的代言暗示。",
            "platform": "抖音",
            "duration_seconds": 15
        },
        {
            "id": 3,
            "title": "100个美丽中国打卡点，能不能改成城市商场打卡穿搭脚本",
            "hook": "大家都在说打卡点，但对本地用户来说，更近的打卡点就是这家商场里的门店。",
            "outline": [
                "开头先说别总想着远地方打卡，本地商场也能拍出状态感。",
                "中段展示门店里的球鞋或服装上身效果。",
                "最后给出到店理由，比如试穿、限时活动、折扣节点。"
            ],
            "source_basis": {
                "trend": "100个美丽中国打卡点名单发布",
                "category": "本地 / 商场活动 / 穿搭",
                "benchmark_pattern": "门店探店 + 打卡转化"
            },
            "fit_reason": "这是当前唯一和‘打卡 / 本地’有轻度关系的热榜词，适合做弱嫁接。",
            "risk_notes": "不要把国家级打卡名单和门店活动硬等同，表达要轻一点。",
            "platform": "抖音",
            "duration_seconds": 15
        },
        {
            "id": 4,
            "title": "看到高考作文的我 belike，能不能改成门店导购剧情",
            "hook": "把高考作文这种全民讨论点，转成‘选鞋比写作文还难’的轻剧情开头。",
            "outline": [
                "开头做一个顾客站在鞋墙前纠结的夸张剧情。",
                "中段导购快速给出两种风格推荐。",
                "结尾回到门店里现在有什么活动或优惠。"
            ],
            "source_basis": {
                "trend": "看到高考作文的我belike",
                "category": "门店导购 / 剧情 / 团购转化",
                "benchmark_pattern": "剧情开头 + 导购口播"
            },
            "fit_reason": "热词本身不直接相关，但‘belike’这类表达适合做轻剧情壳。",
            "risk_notes": "不要消费高考本身，不要做过度娱乐化表达。",
            "platform": "抖音",
            "duration_seconds": 15
        },
        {
            "id": 5,
            "title": "AI 写的高考作文你打几分，能不能改成 AI 选穿搭反转脚本",
            "hook": "最近大家都在聊 AI 写作文，那就反转成：AI 选穿搭真不一定有门店导购懂你。",
            "outline": [
                "开头先抛出一个看似高级但不接地气的 AI 穿搭建议。",
                "中段切换到门店真实上身和导购推荐。",
                "结尾说清楚为什么到店试穿比空想更重要。"
            ],
            "source_basis": {
                "trend": "AI写的高考作文你打几分",
                "category": "门店试穿 / 导购口播 / 剧情反转",
                "benchmark_pattern": "反差开头 + 门店转化"
            },
            "fit_reason": "能借 AI 讨论热度，但实际回到门店体验和商品转化。",
            "risk_notes": "不要踩科技话题太深，重点放在真实试穿体验。",
            "platform": "抖音",
            "duration_seconds": 15
        },
        {
            "id": 6,
            "title": "成何体统 现代婚礼热度，能不能改成情侣球鞋穿搭脚本",
            "hook": "最近婚礼感、情侣感内容很热，那就别讲婚礼，直接讲情侣同款球鞋怎么选。",
            "outline": [
                "开头说最近大家都在刷氛围感，但情侣穿搭最实用的还是鞋。",
                "中段展示两双适合情侣或朋友一起买的鞋款。",
                "结尾落到门店活动和到店搭配建议。"
            ],
            "source_basis": {
                "trend": "成何体统2现代婚礼夯爆了",
                "category": "球鞋 / 穿搭 / 团购活动",
                "benchmark_pattern": "热点嫁接 + 商品露出"
            },
            "fit_reason": "热点是情绪氛围型，不必碰原内容，适合转成情侣或双人购买场景。",
            "risk_notes": "不要使用剧集素材，不要蹭具体 IP 画面。",
            "platform": "抖音",
            "duration_seconds": 15
        },
        {
            "id": 7,
            "title": "黑熊 NPC 整活局，能不能改成门店员工整活短视频",
            "hook": "大家爱看整活，不一定要去漂流，门店员工自己也能整一条轻松好传播的内容。",
            "outline": [
                "开头用员工或导购做一个夸张反差动作吸引注意。",
                "中段快速切到今天店里最好卖或最值得看的鞋服。",
                "结尾给出限时到店信息。"
            ],
            "source_basis": {
                "trend": "黑熊NPC把漂流玩成了整活局",
                "category": "门店活动 / 泛娱乐 / 导购口播",
                "benchmark_pattern": "整活开头 + 商品转场"
            },
            "fit_reason": "品牌语气允许泛娱乐和剧情，适合借‘整活感’而不是借事件本身。",
            "risk_notes": "不要模仿危险行为，不要直接复刻原热点场景。",
            "platform": "抖音",
            "duration_seconds": 15
        },
        {
            "id": 8,
            "title": "一起为高考静音，能不能改成商场门店礼貌感内容",
            "hook": "所有人都在提醒高考静音，那品牌也可以借这个节点做一条有分寸感的门店内容。",
            "outline": [
                "开头用一句这几天大家都在为高考让路，我们也想把活动声音调小一点。",
                "中段展示更克制、更干净的穿搭或球鞋镜头。",
                "结尾轻轻带出门店活动，不要强硬促销。"
            ],
            "source_basis": {
                "trend": "一起为高考静音",
                "category": "品牌表达 / 门店活动 / 轻促销",
                "benchmark_pattern": "节点借势 + 温和收口"
            },
            "fit_reason": "适合做品牌好感度内容，不只做硬转化。",
            "risk_notes": "一定要克制，不能借高考做夸张营销。",
            "platform": "抖音",
            "duration_seconds": 15
        },
        {
            "id": 9,
            "title": "专家辟谣外卖人造大米，能不能改成真假优惠辨别脚本",
            "hook": "这种辟谣类热点的真正可借点，不是内容本身，而是‘别被噱头骗了’。",
            "outline": [
                "开头先说买鞋买衣服也一样，别只看夸张宣传。",
                "中段展示门店里真实可见的款式、价格和活动规则。",
                "结尾给出到店自己看、自己试的理由。"
            ],
            "source_basis": {
                "trend": "专家辟谣外卖用的是人造大米",
                "category": "团购转化 / 真实优惠 / 门店活动",
                "benchmark_pattern": "辟谣壳 + 真实利益点"
            },
            "fit_reason": "适合做反套路表达，和团购场景里的‘别被假优惠骗’逻辑能接上。",
            "risk_notes": "不要碰食品真假本身，重点转到消费辨别逻辑。",
            "platform": "抖音",
            "duration_seconds": 15
        },
        {
            "id": 10,
            "title": "谢娜官宣巡演，能不能改成演唱会出行穿搭脚本",
            "hook": "演唱会季一来，大家首先缺的不是门票，是一套能走能拍的出门穿搭。",
            "outline": [
                "开头说最近又到演唱会和活动扎堆的时候了。",
                "中段展示门店里适合久走、出片、搭配感强的鞋服。",
                "结尾带到门店活动和同城到店试穿。"
            ],
            "source_basis": {
                "trend": "谢娜官宣个人巡回演唱会",
                "category": "穿搭 / 球鞋 / 同城活动",
                "benchmark_pattern": "场景种草 + 门店转化"
            },
            "fit_reason": "演唱会出门穿搭和运动服饰天然相关，容易落到具体商品场景。",
            "risk_notes": "不要碰明星素材和未授权内容，只借出行场景。",
            "platform": "抖音",
            "duration_seconds": 15
        }
    ]

    payload = {
        "brand_name": "adidas阿迪达斯团购号",
        "generated_at": created_at,
        "count": len(scripts),
        "method": "manual synthesis from current Douyin hot list + category pool + brand rules",
        "notes": [
            "这版基于当前真实抖音总热榜和已确认的类目词池生成。",
            "由于今天总热榜与品牌强相关项较少，这 10 条里有一部分是借热点表达壳，而不是直接蹭主题本身。",
            "全部脚本都按 15 秒抖音内容、成交+曝光+涨粉目标来写，并避开违规夸张表达。"
        ],
        "items": scripts,
    }

    out_path = output_dir / f"{stamp}-adidas阿迪达斯团购号-10scripts.json"
    out_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"已生成 10 条脚本: {out_path}")
    for item in scripts:
        print(f"{item['id']}. {item['title']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
