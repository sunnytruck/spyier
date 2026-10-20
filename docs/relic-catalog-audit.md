# レリック参照資料の全件監査

添付の `レリック一覧.txt` をバイト単位で保持し、厳密なCP932互換Shift_JISデコーダーで読み込んだ。全294件・599行。原文の「画像」を挟む同名反復は画像ラベルとして除去し、効果・数値・表記は変更していない。これは資料カタログであり、全件実装済みという意味ではない。

| 資料分類 | 件数 |
| --- | ---: |
| starter | 10 |
| common | 32 |
| uncommon | 38 |
| rare | 50 |
| shop | 30 |
| ancient | 100 |
| event | 34 |

職業の明示はスターター10件のみ。固有リソースや資料の並びから推測した職業は `proposedClasses` に分け、正式な職業制限と混同しない。通常版スターター5件と強化版5件は入手区分を分離した。コモン・アンコモン・レアはnormal、ショップはshop、エンシェントはblessing、イベントはeventとして記録する。

## 実行定義との最新照合

資料の解析状態と実装状態は別に管理する。最新の件数・入手区分・職業制限・未実装全件と個別理由は [レリック実装状態の全件照合](relic-implementation-audit.md) を参照。`node scripts/report-relic-implementation.mjs` で現在の実行定義から再集計できる。

## 既存30件との照合

調査開始時 `0038936` の30件には原文と同名のものはない。同効果だけで同一レリックと断定せず、完全な効果一致・部分一致・一致なしを分ける。実装担当が旧IDを再利用する場合は、実行定義の `sourceRelicId` を原資料IDへ明示的に接続する。資料名とゲーム表示名は別管理し、セーブに保存済みのIDは保持する。

| 旧IDと名称 | 資料上の候補 | 判定 | 相違点・扱い |
| --- | --- | --- | --- |
| `warm_pebble` 温石 | バーニングブラッド、ブラックブラッド | partial_effect | 回復量が4と6/12で異なる。既存IDの効果を黙って変更しない。 |
| `gate_fragment` 門のかけら | イカリ、イカリ？ | partial_effect | 開始時ブロック7と10/4で異なる。 |
| `prayer_knuckle` 祈りの拳石 | ヴァジュラ | effect_match_only | 開始時筋力1は一致するが原文名は異なる。再利用する場合は明示的な原資料バインドで管理する。 |
| `fossil_bookmark` 化石のしおり | バックパック、蛇の指輪 | effect_match_only | 開始時2ドローは一致。蛇の指輪には明示職業があるため、汎用旧IDを二重に割り当てない。 |
| `amber_spark` 琥珀の火種 | ランタン | effect_match_only | 開始時エナジー1は一致するが原文名は異なる。再利用時は原資料バインドを明示する。 |
| `sacred_chalk` 聖なる石筆 | なし | no_source_match | 原文と同名の資料項目はなく、同一レリックとは断定しない。既存独自レリックとして維持する。 |
| `layered_charm` 地層のお守り | なし | no_source_match | 原文と同名の資料項目はなく、同一レリックとは断定しない。既存独自レリックとして維持する。 |
| `morning_bell` 朝活の鈴 | なし | no_source_match | 原文と同名の資料項目はなく、同一レリックとは断定しない。既存独自レリックとして維持する。 |
| `first_vow` 初志の石印 | なし | no_source_match | 原文と同名の資料項目はなく、同一レリックとは断定しない。既存独自レリックとして維持する。 |
| `pilgrim_cup` 巡礼の石杯 | なし | no_source_match | 原文と同名の資料項目はなく、同一レリックとは断定しない。既存独自レリックとして維持する。 |
| `cracked_sandal` 踏ん張りの石履 | なし | no_source_match | 原文と同名の資料項目はなく、同一レリックとは断定しない。既存独自レリックとして維持する。 |
| `waking_hourglass` 二度寝の砂時計 | なし | no_source_match | 原文と同名の資料項目はなく、同一レリックとは断定しない。既存独自レリックとして維持する。 |
| `inkstone_ledger` 三行の石帳 | なし | no_source_match | 原文と同名の資料項目はなく、同一レリックとは断定しない。既存独自レリックとして維持する。 |
| `guard_rhythm` 守りの拍子木 | なし | no_source_match | 原文と同名の資料項目はなく、同一レリックとは断定しない。既存独自レリックとして維持する。 |
| `sword_echo` 三打の岩響 | なし | no_source_match | 原文と同名の資料項目はなく、同一レリックとは断定しない。既存独自レリックとして維持する。 |
| `ember_lens` 煙る琥珀眼 | レッドマスク | effect_match_only | 資料の脱力→weakという既存翻訳契約で、開始時全敵weak1が一致。原文名は異なるため明示バインドで再利用する。 |
| `moss_vial` 毒苔の小壺 | 歪んだ漏斗 | partial_effect | 開始時毒2と4で異なる。 |
| `stone_mask` ひび割れの面 | ビー玉袋 | effect_match_only | 資料の弱体→vulnerableという既存翻訳契約で、開始時全敵vulnerable1が一致。原文名は異なるため明示バインドで再利用する。 |
| `pilgrim_veil` 苔払いの肩布 | なし | no_source_match | 原文と同名の資料項目はなく、同一レリックとは断定しない。既存独自レリックとして維持する。 |
| `victory_ladle` 背水の石杓 | 骨付き肉 | partial_effect | HP半分以下での勝利時回復8と12で異なる。 |
| `amber_hourglass` 三日坊主の砂時計 | なし | no_source_match | 原文と同名の資料項目はなく、同一レリックとは断定しない。既存独自レリックとして維持する。 |
| `quarry_trophy` 石切りの戦利品 | なし | no_source_match | 原文と同名の資料項目はなく、同一レリックとは断定しない。既存独自レリックとして維持する。 |
| `soul_ladle` 鎮魂の茶匙 | なし | no_source_match | 原文と同名の資料項目はなく、同一レリックとは断定しない。既存独自レリックとして維持する。 |
| `echo_prism` 布教の反響石 | なし | no_source_match | 原文と同名の資料項目はなく、同一レリックとは断定しない。既存独自レリックとして維持する。 |
| `dawn_censer` 窮地の香炉 | なし | no_source_match | 原文と同名の資料項目はなく、同一レリックとは断定しない。既存独自レリックとして維持する。 |
| `scarred_bracelet` 血誓の岩腕輪 | なし | no_source_match | 原文と同名の資料項目はなく、同一レリックとは断定しない。既存独自レリックとして維持する。 |
| `silent_whetstone` 影研ぎの砥石 | なし | no_source_match | 原文と同名の資料項目はなく、同一レリックとは断定しない。既存独自レリックとして維持する。 |
| `star_map` 朝焼けの星図 | 月餅 | partial_effect | 星1は同じだがターン開始時と終了時で異なる。 |
| `spirit_lantern` 彼岸の岩灯籠 | 封じられし霊箱、解き放たれし霊箱 | partial_effect | 開始時召喚4は、各ターン召喚1/開始時5かつ各ターン2と異なる。 |
| `core_cage` 霜核の鳥籠 | なし | no_source_match | 原文と同名の資料項目はなく、同一レリックとは断定しない。既存独自レリックとして維持する。 |

## 資料で確定しない点・照合注意点

エンチャントの意味、特定カード・ポーション・召喚キャラクター、特殊報酬やマップの定義が本文にないものは、説明文だけを登録して取得可能にしない。「弱体」は本資料では被ダメージ増加、「脱力」は与ダメージ低下を指すため、旧エンジンのweak/vulnerableへの対応は語句の自動一致で決めない。

| 原文名 | 見出し行 | code | 確認事項 |
| --- | ---: | --- | --- |
| ビー玉袋 | 108 | status_terminology | 資料の「弱体」は被ダメージ増加側。既存カード資料と同じ翻訳契約で vulnerable1 に接続し、weak（与ダメージ低下）とは区別する。 |
| レッドマスク | 120 | status_terminology | 資料の「脱力」は与ダメージ低下側。既存カード資料と同じ翻訳契約で weak1 に接続する。 |
| 石化したカエル | 138 | undefined_named_item | 「ポーション風の岩」の効果・所持区分・取得先が資料内にない。 |
| 折りキャエル | 152 | status_terminology | 資料の「弱体」は被ダメージ1.5倍→1.75倍。既存カード資料と同じ翻訳契約で vulnerable へ接続する。原文名の表記は補正しない。 |
| 星屑 | 160 | unsupported_star_spending | 星の消費を参照するが、現在のIWASONカードは星を獲得・参照する仕組み。資料のない星コストを追加しない。 |
| 金メッキケーブル | 168 | orb_position_review | 資料は「右端」のオーブ。先頭解放オーブと同じ位置とは限らないため、保持配列とHUDの向きを照合する。 |
| 折りズル | 250 | status_terminology | 資料の「脱力」は与ダメージ0.75倍→0.6倍。既存カード資料と同じ翻訳契約で weak へ接続し、被ダメージ増加側とは区別する。 |
| ちびリージェント | 256 | unsupported_star_spending | 星を消費する契機が未定義。既存の星獲得時発動に置き換えない。 |
| パンチダガー | 282 | undefined_enchantment | エンチャントの数値規則・発動時期・重複規則が資料内にない: モメンタム。 |
| 王家の印 | 290 | undefined_enchantment | エンチャントの数値規則・発動時期・重複規則が資料内にない: 王室認可。 |
| 節くれ立った槌 | 300 | undefined_enchantment | エンチャントの数値規則・発動時期・重複規則が資料内にない: 鋭利。 |
| 太陽系儀 | 304 | ambiguous_card_reward | 「カード報酬を5枚」は5つの報酬画面か5枚の直接取得かが資料だけでは一意でない。 |
| 木札 | 312 | undefined_enchantment | エンチャントの数値規則・発動時期・重複規則が資料内にない: 巧妙。 |
| 翼のチャーム | 320 | undefined_enchantment | エンチャントの数値規則・発動時期・重複規則が資料内にない: スイフト。 |
| 巻物箱 | 342 | undefined_card_packs | 「2つのカードパック」の内容・カード数・選択単位が資料内にない。 |
| 巨大な巻物 | 346 | unsupported_multiplayer | マルチプレイ用カードの対象・単独プレイ時の処理が資料内にない。 |
| 溶岩石 | 370 | boss_drop_review | 第1層ボスのレリック2個ドロップを参照。既存ボス報酬の取得単位と統合が必要。 |
| 古代の牙 | 380 | undefined_ancient_cards | スターターカードのエンシェント版の定義・変化先が資料内にない。 |
| 電気エビ | 386 | undefined_enchantment | エンチャントの数値規則・発動時期・重複規則が資料内にない: 刻印。 |
| パエルの眼 | 394 | extra_turn_review | 追加ターンと廃棄誘発、敵の毒・破滅タイミングを既存ターン処理へ正確に接続する必要がある。 |
| パエルの軍勢 | 396 | undefined_sleep | 眠り2ターン中のカード使用・敵ターン・スキップ条件の規則が資料内にない。 |
| パエルの爪 | 402 | undefined_enchantment | エンチャントの数値規則・発動時期・重複規則が資料内にない: べとべと。 |
| パエルの膿 | 406 | undefined_enchantment | エンチャントの数値規則・発動時期・重複規則が資料内にない: クローン。 |
| おもちゃ箱 | 418 | undefined_toy_relics | おもちゃレリックの対象・効果と消滅時の処理が資料内にない。 |
| 栄養満点のスープ | 422 | undefined_enchantment | エンチャントの数値規則・発動時期・重複規則が資料内にない: テスカタラの残り火。 |
| 黄金の羅針盤 | 426 | map_replacement_review | 第2層の「1本道の特別なルート」の部屋構成が資料内にない。通常マップの線を消すだけで完了扱いにしない。 |
| ラメ | 436 | undefined_enchantment | エンチャントの数値規則・発動時期・重複規則が資料内にない: グラム。 |
| 毛皮のコート | 448 | map_marking_review | ランダム戦闘7箇所の対象Act・ボス/エリートの扱いが資料内では未指定。 |
| 麗しの腕輪 | 450 | undefined_enchantment | エンチャントの数値規則・発動時期・重複規則が資料内にない: スイフト。 |
| 三又ブーメラン | 464 | undefined_enchantment | エンチャントの数値規則・発動時期・重複規則が資料内にない: 本能。 |
| 肉切り包丁 | 468 | undefined_rest_action | 休憩所の「料理」で得られる効果・費用・使用回数が資料内にない。 |
| 囁きのイヤリング | 490 | undefined_autoplay_policy | ヴァクーが初手を代行する戦略・対象選択・カード選択の規則が資料内にない。 |
| 呼びよせる鐘 | 512 | undefined_named_curse | 「特殊な呪い」の名前・効果・削除可否が資料内にない。 |
| 薄汚れた本 | 514 | undefined_ancient_cards | 「エンシェントカード」の対象プール・カード定義が資料内にない。 |
| ドリームキャッチャー | 528 | ambiguous_card_reward | 「カードを1枚デッキに加えてもよい」の候補・選択範囲が資料内にない。 |
| ビャードのヒナ | 534 | undefined_companion | 同行するヒナのHP・攻撃・護衛の仕様が資料内にない。 |
| フレネルレンズ | 538 | undefined_enchantment | エンチャントの数値規則・発動時期・重複規則が資料内にない: 身軽。 |
| 商人の敷物？ | 560 | intentional_no_effect | 資料が明示する偽物の無効果。未実装の効果とは区別する。 |
| 石の剣 | 562 | undefined_relic_transformation | エリート5体撃破後の「強力なレリック」の変化先が資料内にない。 |
| ネオーの骨 | 590 | undefined_relic_pool | 「ネオーのレリック」の対象一覧が資料内にない。エンシェント全体と勝手に同一視しない。 |
| 絹の髪束 | 596 | undefined_enchantment | エンチャントの数値規則・発動時期・重複規則が資料内にない: 魅惑。 |

## 全件一覧

`pending` は「資料解析済み・実装可否未確定」、`needs_review` は「資料側の注意点あり」を意味する。ゲームでの実装状況は実行定義と `sourceRelicId` で照合するため、この固定資料JSONのstatusを取得可能判定へ使用しない。発動時期と必要機構は原文の字句観測であり、実行仕様を補うものではない。

| 行 | 原資料ID | 原文名 | 分類 / 入手 | 職業 | 原文効果 | 発動時期 | 必要機構 | 資料状態 |
| ---: | --- | --- | --- | --- | --- | --- | --- | --- |
| 2 | `relsrc_707367f80e0e` | バーニングブラッド | starter / starter | berserker（明示） | 戦闘終了時、HPを6回復する。 | combatEnd | hp | pending |
| 5 | `relsrc_d6ca8699742d` | 蛇の指輪 | starter / starter | assassin（明示） | 戦闘開始時、追加でカードを2枚引く。 | combatStart | draw | pending |
| 8 | `relsrc_8e2a931f58fe` | 神授王権 | starter / starter | oracle（明示） | 戦闘開始時、スター3を得る。 | combatStart | stars | pending |
| 11 | `relsrc_29cb8891c2ba` | 封じられし霊箱 | starter / starter | necromancer（明示） | ターン開始時、召喚1 | turnStart | summon | pending |
| 14 | `relsrc_168c538bc564` | ひび割れたコア | starter / starter | machinist（明示） | 戦闘開始時、ライトニング1を生成する。 | combatStart | orb | pending |
| 17 | `relsrc_a0839a979413` | ブラックブラッド | starter / starterUpgrade | berserker（明示） | 戦闘終了時、HPを12回復する。 | combatEnd | hp | pending |
| 20 | `relsrc_ee811290c826` | ドレイクの指輪 | starter / starterUpgrade | assassin（明示） | 最初の3ターンの開始時、追加でカードを2枚引く。 | turnStart, periodic | draw, combatCounter | pending |
| 23 | `relsrc_483a10fe5f8e` | 神授天命 | starter / starterUpgrade | oracle（明示） | 戦闘開始時、スター6を得る。 | combatStart | stars | pending |
| 26 | `relsrc_1b9ca9420f81` | 解き放たれし霊箱 | starter / starterUpgrade | necromancer（明示） | 戦闘開始時、召喚5。ターン開始時、召喚2 | combatStart, turnStart | summon | pending |
| 29 | `relsrc_fff9512092d4` | インフューズドコア | starter / starterUpgrade | machinist（明示） | 戦闘開始時、ライトニング3を生成する。 | combatStart | orb | pending |
| 32 | `relsrc_42fbd5b0d472` | アメジストのナス | common / normal | 未記載 | 敵は追加で15ゴールドをドロップする。 | goldReward | gold | pending |
| 34 | `relsrc_a7524bccd351` | イカリ | common / normal | 未記載 | 戦闘開始時、10ブロックを得る。 | combatStart | block | pending |
| 36 | `relsrc_2b8db40b5fd0` | イチゴ | common / normal | 未記載 | 取得時、最大HPが7増加する。 | acquire | hp | pending |
| 38 | `relsrc_a353ac8debe2` | ヴァジュラ | common / normal | 未記載 | 戦闘開始時、筋力1を得る。 | combatStart | strength | pending |
| 40 | `relsrc_5777cb966527` | お食事券 | common / normal | 未記載 | ショップを訪れるたび、HPを15回復する。 | shop | hp | pending |
| 42 | `relsrc_e89e21519b12` | クラッカー | common / normal | 未記載 | 戦闘開始時、すべての敵に9ダメージを与える。 | combatStart | damage | pending |
| 44 | `relsrc_36ac14959340` | ゴルゲット | common / normal | 未記載 | 戦闘開始時、プレート4を得る。 | combatStart | platedArmor | pending |
| 46 | `relsrc_e623274116b6` | ストライク・ダミー | common / normal | 未記載 | 名前に「ストライク」を含むカードは追加で3ダメージを与える。 | continuous | damage | pending |
| 48 | `relsrc_784ff4e6fbee` | すべすべ石 | common / normal | 未記載 | 戦闘開始時、敏捷1を得る。 | combatStart | dexterity | pending |
| 50 | `relsrc_0fd1adb01829` | バックパック | common / normal | 未記載 | 戦闘開始時、追加でカードを2枚引く。 | combatStart | draw | pending |
| 52 | `relsrc_9e061705d058` | ハッピーフラワー | common / normal | 未記載 | 3ターンごとに、エナジー1を得る。 | periodic | energy, combatCounter | pending |
| 54 | `relsrc_3b2e933a5f3f` | ポーションベルト | common / normal | 未記載 | 取得時、ポーションスロットを2個得る。 | acquire | potion | pending |
| 56 | `relsrc_904ab1459de4` | ランタン | common / normal | 未記載 | 戦闘開始時、追加でエナジー1を得る。 | combatStart | energy | pending |
| 58 | `relsrc_47bb929ef5a2` | 永久氷晶 | common / normal | 未記載 | 各戦闘で初めてパワーをプレイしたとき、7ブロックを得る。 | cardPlayed | block, combatCounter | pending |
| 60 | `relsrc_aa1db4f933e5` | 血のガラス瓶 | common / normal | 未記載 | 戦闘開始時、HPを2回復する。 | combatStart | hp | pending |
| 62 | `relsrc_88928f352a8e` | 古びたティーセット | common / normal | 未記載 | 休憩所を訪れるたび、次の戦闘を追加のエナジー2を得た状態で開始する。 | rest | energy | pending |
| 64 | `relsrc_431a780aa654` | 五輪書 | common / normal | 未記載 | デッキにカードを5枚追加するたび、HPを20回復する。 | cardAdded, periodic | hp, deck | pending |
| 66 | `relsrc_b82e007bc0cd` | 高貴な枕 | common / normal | 未記載 | 休憩するたび、追加でHPを15回復する。 | rest | hp | pending |
| 68 | `relsrc_2b3adfd63fe8` | 小さなポスト | common / normal | 未記載 | 休憩するたび、ランダムなポーションを2個獲得する。 | rest | potion | pending |
| 70 | `relsrc_69d10a6667d7` | 振り子 | common / normal | 未記載 | 3ターンごとに、カードを1枚引く。 | periodic | draw, combatCounter | pending |
| 72 | `relsrc_7b5dac843c69` | 数珠 | common / normal | 未記載 | ?の部屋で通常の敵と遭遇しなくなる。 | eventRoom | map | pending |
| 74 | `relsrc_0fad6477a0c2` | 青銅のウロコ | common / normal | 未記載 | 戦闘開始時、トゲ3を得る。 | combatStart | thorns | pending |
| 76 | `relsrc_e20a8c07d102` | 戦化粧 | common / normal | 未記載 | 取得時、ランダムなスキルを2枚アップグレードする。 | acquire | upgrade | pending |
| 78 | `relsrc_3f5989e86573` | 砥石 | common / normal | 未記載 | 取得時、ランダムなアタックを2枚アップグレードする。 | acquire | upgrade | pending |
| 80 | `relsrc_2e5f64d0fe0c` | 百年パズル | common / normal | 未記載 | 各戦闘で初めてHPを失った時、カードを3枚引く。 | hpLost | hp, draw, combatCounter | pending |
| 82 | `relsrc_a7734dd2f559` | 赤い頭蓋骨 | common / normal | berserker（推定） | HPが50%以下の間、追加で筋力3を得る。 | continuous | strength, hp | pending |
| 84 | `relsrc_164693a8ea43` | スネッコスカル | common / normal | assassin（推定） | 毒を付与するたび、追加で毒1を付与する。 | resource | poison | pending |
| 86 | `relsrc_85b6d5244bd3` | 剣術教本 | common / normal | oracle（推定） | 戦闘開始時、鍛造10 | combatStart | forge | pending |
| 88 | `relsrc_38831386cc2e` | 骨のフルート | common / normal | necromancer（推定） | オスティがアタックするたび、2ブロックを得る。 | resource | block, summon | pending |
| 90 | `relsrc_461589fa6228` | データディスク | common / normal | machinist（推定） | 戦闘開始時、集中力1を得る。 | combatStart | focus | pending |
| 92 | `relsrc_e13252effaa0` | ヴァンプレイス | uncommon / normal | 未記載 | 各戦闘で初めてカードからブロックを得たとき、その値が2倍になる。 | cardBlock | block, combatCounter | pending |
| 94 | `relsrc_a18ba0ee74bc` | エターナルフェザー | uncommon / normal | 未記載 | 休憩所を訪れるたび、デッキにあるカード5枚ごとに、HPを3回復する。 | rest | hp, deck | pending |
| 96 | `relsrc_73a638932720` | オリハルコン | uncommon / normal | 未記載 | ブロックなしでターンを終了した場合、6ブロックを得る。 | turnEnd | block | pending |
| 98 | `relsrc_02cdb3c7d037` | キラめく口紅 | uncommon / normal | 未記載 | 3ターン目の開始時、筋力1と敏捷1を得る。 | turnStart, periodic | strength, dexterity | pending |
| 100 | `relsrc_dd6e09ddbdba` | グレムリンの角 | uncommon / normal | 未記載 | 敵が倒れるたび、エナジー1を得て、カードを1枚引く。 | enemyKilled | draw, energy | pending |
| 102 | `relsrc_d71c06c0bb33` | ヌンチャク | uncommon / normal | 未記載 | アタックを10回プレイするたび、エナジー1を得る。 | cardPlayed, periodic | energy | pending |
| 104 | `relsrc_950447e720d3` | パリィシールド | uncommon / normal | 未記載 | 10以上のブロックを得た状態でターンを終了した場合、ランダムな敵に6ダメージを与える。 | turnEnd | damage, block | pending |
| 106 | `relsrc_c45a0906ebe2` | パンタグラフ | uncommon / normal | 未記載 | ボスとの戦闘開始時、HPを25回復する。 | combatStart | hp | pending |
| 108 | `relsrc_1d1fcb9c4ff1` | ビー玉袋 | common / normal | 未記載 | 戦闘開始時、すべての敵に弱体1を付与する。 | combatStart | debuff | pending |
| 110 | `relsrc_912a35325aae` | ふいご | rare / normal | 未記載 | 各戦闘で最初の手札をすべてアップグレードする。 | combatStart | upgrade | pending |
| 112 | `relsrc_d0f23e349cd2` | ペン先 | uncommon / normal | 未記載 | アタックを10回プレイするたび、そのダメージが2倍になる。 | cardPlayed, periodic, continuous | damage | pending |
| 114 | `relsrc_4d8a166d4303` | ホーンクリート | uncommon / normal | 未記載 | 2ターン目の開始時、14ブロックを得る。 | turnStart, periodic | block | pending |
| 116 | `relsrc_faf9668d0092` | ミニ大砲 | uncommon / normal | 未記載 | アップグレードされたアタックは追加で3ダメージを与える。 | continuous | damage, upgrade | pending |
| 118 | `relsrc_feebef38d034` | レターオープナー | uncommon / normal | 未記載 | 1ターンの間にスキルを3枚プレイするたび、すべての敵に5ダメージを与える。 | cardPlayed, periodic, continuous | damage | pending |
| 120 | `relsrc_bddea18adfd1` | レッドマスク | common / normal | 未記載 | 戦闘開始時、すべての敵に脱力1を付与する。 | combatStart | debuff | pending |
| 122 | `relsrc_c22c7fb43775` | 音叉 | uncommon / normal | 未記載 | スキルを10枚プレイするたび、7ブロックを得る。 | cardPlayed, periodic | block | pending |
| 124 | `relsrc_b6c76c67fc37` | 幸運の魚 | uncommon / normal | 未記載 | デッキにカードを追加するたび、15ゴールドを獲得する。 | cardAdded | gold, deck | pending |
| 126 | `relsrc_33bab008979b` | 鎖鎌 | uncommon / normal | 未記載 | 1ターンの間にアタックを3枚プレイするたび、ランダムな敵に6ダメージを与える。 | cardPlayed, periodic, continuous | damage | pending |
| 128 | `relsrc_9a0656232119` | 山高帽 | uncommon / normal | 未記載 | 獲得ゴールドが25%増加する。 | goldReward | gold | pending |
| 130 | `relsrc_956e27529667` | 燭台 | uncommon / normal | 未記載 | 2ターン目の開始時、エナジー2を得る。 | turnStart, periodic | energy | pending |
| 132 | `relsrc_b88297b0f596` | 水銀の砂時計 | uncommon / normal | 未記載 | ターン開始時、すべての敵に3ダメージを与える。 | turnStart | damage | pending |
| 134 | `relsrc_a1c6a2b64e6f` | 星座早見盤 | uncommon / normal | 未記載 | ?部屋を訪れるたび、HPを5回復する。 | eventRoom | hp, map | pending |
| 136 | `relsrc_ec95e5f209a4` | 石のクラッカー | uncommon / normal | 未記載 | 戦闘開始時、山札にあるランダムなカード2枚を戦闘終了までアップグレードする。 | combatStart, combatEnd | deck, upgrade | pending |
| 138 | `relsrc_6e6c08af055c` | 石化したカエル | uncommon / normal | 未記載 | 戦闘開始時、ポーション風の岩を獲得する。 | combatStart | potion | needs_review |
| 140 | `relsrc_27ee01b76482` | 赤べこ | uncommon / normal | 未記載 | 戦闘開始時、活力8を得る。 | combatStart | vigor | pending |
| 142 | `relsrc_dd5f8d8801d2` | 扇子 | uncommon / normal | 未記載 | 1ターンの間にアタックを3枚プレイするたび、4ブロックを得る。 | cardPlayed, periodic, continuous | block | pending |
| 144 | `relsrc_157cdf1a2590` | 波紋の鉢 | uncommon / normal | 未記載 | 自身のターン中にアタックをプレイしなかった場合、4ブロックを得る。 | noAttackTurn | block | pending |
| 146 | `relsrc_4f3e6f31d9a5` | 冥銭 | uncommon / normal | 未記載 | カードを5回廃棄するたび、カードを1枚引く。 | cardExhausted, periodic | draw, exhaust | pending |
| 148 | `relsrc_ba0514ebc01e` | 洋ナシ | uncommon / normal | 未記載 | 取得時、最大HPが10増加する。 | acquire | hp | pending |
| 150 | `relsrc_4f7c59c27e66` | 爬虫類のトリンケット | uncommon / normal | 未記載 | ポーションを使用するたび、ターン終了時まで筋力3を得る。 | turnEnd | strength, potion | pending |
| 152 | `relsrc_9fe2a7e062a6` | 折りキャエル | uncommon / normal | berserker（推定） | 弱体状態の敵に与えるダメージが50%増加から75%増加になる。 | continuous | damage, debuff | pending |
| 154 | `relsrc_f12cf6c89853` | 自己形成粘土 | uncommon / normal | berserker（推定） | 戦闘中にHPを失うたび、次のターン、3ブロックを得る。 | hpLost | block, hp | pending |
| 156 | `relsrc_8eb7ba475b5b` | ティンシャ | uncommon / normal | assassin（推定） | 自身のターン中にカードを捨てるたび、捨てたカード1枚につき、ランダムな敵に3ダメージを与える。 | cardDiscarded | damage, discard | pending |
| 158 | `relsrc_1e2007ecb3b8` | 歪んだ漏斗 | uncommon / normal | assassin（推定） | 戦闘開始時、すべての敵に毒4を付与する。 | combatStart | poison | pending |
| 160 | `relsrc_c2e14c5a028c` | 星屑 | uncommon / normal | oracle（推定） | 10スターを消費するたび、10ブロックを得る。 | resource, periodic | block, stars | needs_review |
| 162 | `relsrc_703adaa3177c` | レガライト | uncommon / normal | oracle（推定） | カードを作成するたび、2ブロックを得る。 | cardCreated | block | pending |
| 164 | `relsrc_bd572cf85b4a` | 製本用ナイフ | uncommon / normal | necromancer（推定） | ミニオン以外の敵を破滅で倒すたび、HPを3回復する。 | enemyKilled | hp, doom | pending |
| 166 | `relsrc_7c61ee44791c` | デスマスク | uncommon / normal | necromancer（推定） | 戦闘開始時、ソウルを3枚山札に加える。 | combatStart | deck, soul | pending |
| 168 | `relsrc_9c6f3190956f` | 金メッキケーブル | uncommon / normal | machinist（推定） | 右端のオーブの自動効果が追加で1回発動する。 | orbPassive | orb | pending |
| 170 | `relsrc_6e72a80d9c9f` | 共生ウイルス | uncommon / normal | machinist（推定） | 戦闘開始時、ダーク1を生成する。 | combatStart | orb | pending |
| 172 | `relsrc_d4591ff147ec` | アイスクリーム | rare / normal | 未記載 | 余ったエナジーを次のターンに持ち越せるようになる。 | continuous | energy | pending |
| 174 | `relsrc_3a96836cce26` | ギャンブルチップ | rare / normal | 未記載 | 戦闘開始時、カードを任意の枚数捨て、その数に等しいカードを引く。 | combatStart | draw, discard | pending |
| 176 | `relsrc_a774ec420a4d` | クナイ | rare / normal | 未記載 | 1ターンの間にアタックを3枚プレイするたび、敏捷1を得る。 | cardPlayed, periodic, continuous | dexterity | pending |
| 178 | `relsrc_2e072e4e4567` | ゲームの駒 | rare / normal | 未記載 | パワーをプレイするたび、カードを1枚引く。 | cardPlayed | draw | pending |
| 180 | `relsrc_e8c24958e4ab` | ケトルベル | rare / normal | 未記載 | 休憩所で筋力トレーニングができる。(最大3回) | rest | strength | pending |
| 182 | `relsrc_f7df4f2f9780` | シャンデリア | rare / normal | 未記載 | 3ターン目の開始時、エナジー3を得る。 | turnStart, periodic | energy | pending |
| 184 | `relsrc_7f2672268e6f` | ショベル | rare / normal | 未記載 | 休憩所で発掘し、ランダムなレリックを1個獲得できるようになる。 | rest, continuous | reward | pending |
| 186 | `relsrc_52471313524e` | タングステンの棒 | rare / normal | 未記載 | HPを失うたび、その失う量が1減少する。 | hpLost | hp | pending |
| 188 | `relsrc_3c922b12989d` | トカゲのしっぽ | rare / normal | 未記載 | 戦闘不能時、一度だけ最大HPの50%で復活する。 | hpLost | hp, revive | pending |
| 190 | `relsrc_0e9091062697` | ホワイトスター | rare / normal | 未記載 | エリートは追加でレアカード報酬をドロップする。 | reward | reward | pending |
| 192 | `relsrc_63341e63671d` | マニ車 | rare / normal | 未記載 | 通常の敵が追加のカード報酬をドロップするようになる。 | reward, continuous | reward | pending |
| 194 | `relsrc_e70353f5d2f1` | マンゴー | rare / normal | 未記載 | 取得時、最大HPが14増加する。 | acquire | hp | pending |
| 196 | `relsrc_26cfdef0cff5` | マントの留め具 | rare / normal | 未記載 | ターン終了時、手札のカード1枚につき、1ブロックを得る。 | turnEnd | block | pending |
| 198 | `relsrc_b6f9f6550a02` | ミイラの手 | rare / normal | 未記載 | パワーをプレイするたび、手札のランダムなカード1枚を、ターン終了時までコストを支払わずにプレイできる。 | turnEnd, cardPlayed | cost | pending |
| 200 | `relsrc_7fc8943e7bb9` | 威圧の兜 | rare / normal | 未記載 | コストがエナジー2以上のカードをプレイするたび、4ブロックを得る。 | cardPlayed | block, energy, cost | pending |
| 202 | `relsrc_90550d7f9b5a` | 永久コマ | rare / normal | 未記載 | 自身のターン中に手札が0枚になるたび、カードを1枚引く。 | handEmpty | draw | pending |
| 204 | `relsrc_790927503ff9` | 懐中時計 | rare / normal | 未記載 | 自身のターン中にプレイしたカードが3枚以下の場合、次のターン開始時に追加でカードを3枚引く。 | turnStart, cardPlayed | draw | pending |
| 206 | `relsrc_4ec2747e7893` | 頑丈なクランプ | rare / normal | 未記載 | 10ブロックまでを、次のターンに持ち越せるようになる。 | continuous | block | pending |
| 208 | `relsrc_c74ca1cf03c0` | 古いコイン | rare / normal | 未記載 | 取得時、300ゴールドを獲得する。 | acquire | gold | pending |
| 210 | `relsrc_d48c5302564f` | 骨付き肉 | rare / normal | 未記載 | 戦闘終了時にHPが50%以下の場合、HPを12回復する。 | combatEnd | hp | pending |
| 212 | `relsrc_458e41dca431` | 手裏剣 | rare / normal | 未記載 | 1ターンの間にアタックを3枚プレイするたび、筋力1を得る。 | cardPlayed, periodic, continuous | strength | pending |
| 214 | `relsrc_c3607ea0ae10` | 船長の舵輪 | rare / normal | 未記載 | 3ターン目の開始時、18ブロックを得る。 | turnStart, periodic | block | pending |
| 216 | `relsrc_f20770f198d8` | 孫子兵法 | rare / normal | 未記載 | 自身のターンにアタックをプレイしなかった場合、次のターン、追加でエナジー1を得る。 | noAttackTurn | energy | pending |
| 218 | `relsrc_36856360db3f` | 長持ちキャンディ | uncommon / normal | 未記載 | 戦闘1回おきに、カード報酬に追加でパワー1枚が加わる。 | reward | reward | pending |
| 220 | `relsrc_83cebebf8f6d` | 剃刀の牙 | rare / normal | 未記載 | アタックかスキルをプレイするたび、戦闘終了までそれをアップグレードする。 | combatEnd, cardPlayed | upgrade | pending |
| 222 | `relsrc_1ae27a90d667` | 凍った卵 | rare / normal | 未記載 | デッキにパワーを追加するたび、アップグレードする。 | cardAdded | deck, upgrade | pending |
| 224 | `relsrc_4884c528fddf` | 毒の卵 | rare / normal | 未記載 | デッキにスキルを追加するたび、それをアップグレードする。 | cardAdded | deck, upgrade | pending |
| 226 | `relsrc_c410ab81ba03` | 難解なパズル | rare / normal | 未記載 | 戦闘開始時、ランダムなカードを1枚手札に加える。それはコストを支払わずにプレイできる。 | combatStart | draw, cost | pending |
| 228 | `relsrc_b2ccf1d164f8` | 虹の指輪 | rare / normal | 未記載 | 毎ターン、アタック・スキル・パワーの3種類を初めてプレイした時、筋力1と敏捷1を得る。 | cardPlayed | strength, dexterity, combatCounter | pending |
| 230 | `relsrc_f576ec934826` | 配達人 | rare / normal | 未記載 | 商人のカード、レリック、ポーションが売り切れにならない。価格は20%割引される。 | shop | gold, potion | pending |
| 232 | `relsrc_b9b528e6bad2` | 白き獣の像 | rare / normal | 未記載 | 戦闘の報酬にポーションが必ず含まれるようになる。 | continuous | potion, reward | pending |
| 234 | `relsrc_fb0ef31a49ec` | 不気味なランプ | rare / normal | 未記載 | 各戦闘で初めて敵にデバフを付与するカードをプレイしたとき、その効果を2倍にする。 | cardPlayed | combatCounter | pending |
| 236 | `relsrc_e4f82e2e930d` | 脈打つ亡骸 | rare / normal | 未記載 | 1ターンに失うHPは最大20までになる。 | periodic | hp | pending |
| 238 | `relsrc_8eacad2c3f0f` | 溶融した卵 | rare / normal | 未記載 | デッキにアタックを追加するたび、それをアップグレードする。 | cardAdded | deck, upgrade | pending |
| 240 | `relsrc_3e4b951d278d` | 暦石 | rare / normal | 未記載 | 7ターン目の終了時、すべての敵に52ダメージを与える。 | turnEnd, periodic | damage | pending |
| 242 | `relsrc_458f8db43af9` | カロンの遺灰 | rare / normal | berserker（推定） | カードを廃棄するたび、すべての敵に3ダメージを与える。 | cardExhausted | damage, exhaust | pending |
| 244 | `relsrc_f6133c29f100` | 悪魔の舌 | rare / normal | berserker（推定） | 自分のターンに初めてHPを失った時、その値に等しいHPを回復する。 | hpLost | hp | pending |
| 246 | `relsrc_4154b12d6ffd` | 朽ちた兜 | rare / normal | berserker（推定） | 各戦闘で初めて筋力を得たとき、その値が2倍になる。 | resource | strength, combatCounter | pending |
| 248 | `relsrc_b8e3c6be1afd` | 螺旋のダーツ | rare / normal | assassin（推定） | ナイフをプレイするたび、ターン終了時まで敏捷1を得る。 | turnEnd, cardPlayed | dexterity | pending |
| 250 | `relsrc_c2e3b60efcd8` | 折りズル | rare / normal | assassin（推定） | 脱力状態の敵から受けるダメージが25%減少から40%減少になる。 | continuous | damage, debuff | pending |
| 252 | `relsrc_b86a34e153d0` | 丈夫な包帯 | rare / normal | assassin（推定） | 自身のターン中にカードを捨てるたび、3ブロックを得る。 | cardDiscarded | block, discard | pending |
| 254 | `relsrc_86e5b8ef7c01` | 月餅 | rare / normal | oracle（推定） | ターン終了時、スター1を得る。 | turnEnd | stars | pending |
| 256 | `relsrc_8a58b07613a4` | ちびリージェント | rare / normal | oracle（推定） | 毎ターン、初めてスターを消費した時、筋力1を得る。 | resource | strength, stars, combatCounter | needs_review |
| 258 | `relsrc_8e8a3e02ba2a` | オレンジ色の生地 | rare / normal | oracle（推定） | 戦闘開始時、ランダムな無色カードを2枚手札に加える。 | combatStart | draw | pending |
| 260 | `relsrc_cf8c8e22c27b` | ビックハット | rare / normal | necromancer（推定） | 戦闘開始時、ランダムなエセリアルを2枚手札に加える。 | combatStart | draw, ethereal | pending |
| 262 | `relsrc_6c0efcd48c33` | 栞 | rare / normal | necromancer（推定） | ターン終了時、ランダムな保留したカード1枚のコストが、プレイされるまで1減少する。 | turnEnd | cost, retain | pending |
| 264 | `relsrc_f4551ccdb67c` | 象牙の牌 | rare / normal | necromancer（推定） | コストがエナジー3以上のカードをプレイするたび、エナジー1を得る。 | cardPlayed | energy, cost | pending |
| 266 | `relsrc_45e3504b04a3` | 感情制御回路 | rare / normal | machinist（推定） | ターン開始時、前のターンにHPを失っていた場合、すべてのオーブの自動効果を発動する。 | turnStart, orbPassive | hp, orb | pending |
| 268 | `relsrc_dae823312359` | メトロノーム | rare / normal | machinist（推定） | 各戦闘で初めてオーブを7個生成した時、すべての敵に30ダメージを与える。 | resource | damage, orb, combatCounter | pending |
| 270 | `relsrc_1571847bf087` | パワーセル | rare / normal | machinist（推定） | 戦闘開始時、山札から0コストのカードを2枚手札に加える。 | combatStart | draw, cost, deck | pending |
| 272 | `relsrc_dfd2fe69860e` | ケミカルX | shop / shop | 未記載 | コストXのカードの効果が2増加する。 | continuous | cost | pending |
| 274 | `relsrc_d192ade72d0b` | そろばん | shop / shop | 未記載 | 山札をシャッフルするたび、6ブロックを得る。 | shuffle | block, deck | pending |
| 276 | `relsrc_bc3e9a4610a3` | ドラゴンフルーツ | shop / shop | 未記載 | ゴールドを獲得するたび、最大HPが1増加する。 | goldGained | hp, gold | pending |
| 278 | `relsrc_c85452b8448e` | ドリーの鏡 | shop / shop | 未記載 | 取得時、デッキにあるカードを1枚コピーする。 | acquire | deck, copy | pending |
| 280 | `relsrc_433c68371a3d` | パン | shop / shop | 未記載 | 1ターン目の開始時、エナジー2を失う。それ以降のターン開始時、エナジー1を得る。 | turnStart, periodic | energy | pending |
| 282 | `relsrc_846366508c8d` | パンチダガー | shop / shop | 未記載 | 取得時、アタック1枚にモメンタム5をエンチャントする。 | acquire | enchantment | needs_review |
| 284 | `relsrc_a25cfa0426de` | ベルトの留め具 | shop / shop | 未記載 | ポーションを持っていない間、追加で敏捷2を得る。 | continuous | dexterity, potion | pending |
| 286 | `relsrc_e30096a30058` | ミニテント | shop / shop | 未記載 | 休憩所で好きな数の選択肢を実行できる。 | rest |  | pending |
| 288 | `relsrc_d4e219558e47` | リーのワッフル | shop / shop | 未記載 | 取得時、最大HPが7増加し、HPを全回復する。 | acquire | hp | pending |
| 290 | `relsrc_a17418d67e10` | 王家の印 | shop / shop | 未記載 | 取得時、デッキにあるアタックかスキルを1枚選び、王室認可をエンチャントする。 | acquire | deck, enchantment | needs_review |
| 292 | `relsrc_837f5d627f35` | 会員カード | shop / shop | 未記載 | 全商品、50%オフ！ | continuous | gold | pending |
| 294 | `relsrc_c6acd5f197bc` | 共鳴するトライアングル | shop / shop | 未記載 | 戦闘時、最初のターンに手札をすべて保留する。 | combatStart | retain | pending |
| 296 | `relsrc_5c809fbbbb37` | 護摩木 | shop / shop | 未記載 | 各戦闘で初めてスキルを廃棄した時、そのコピーを1枚手札に加える。 | cardExhausted | draw, copy, exhaust, combatCounter | pending |
| 298 | `relsrc_43a98a779d06` | 神秘のライター | shop / shop | 未記載 | エンチャントされたアタックは、追加で9ダメージを与える。 | continuous | damage, enchantment | pending |
| 300 | `relsrc_6bb88a48d162` | 節くれ立った槌 | shop / shop | 未記載 | 取得時、3枚までのアタックに、鋭利3をエンチャントする。 | acquire | enchantment | needs_review |
| 302 | `relsrc_aaccb9b30498` | 絶叫のフラゴン | shop / shop | 未記載 | 手札が0枚の状態でターンを終了した場合、すべての敵に20ダメージを与える。 | turnEnd | damage | pending |
| 304 | `relsrc_11a4ebdbd248` | 太陽系儀 | shop / shop | 未記載 | 取得時、カード報酬を5枚獲得する。 | acquire, reward | reward | needs_review |
| 306 | `relsrc_c1053e49554d` | 大釜 | shop / shop | 未記載 | 取得時、ランダムなポーションを5個調合する。 | acquire | potion | pending |
| 308 | `relsrc_d7a0e8f3fa06` | 道具箱 | shop / shop | 未記載 | 戦闘開始時、3枚のランダムな無色カードから1枚選び、手札に追加する。 | combatStart |  | pending |
| 310 | `relsrc_8e3550af6d72` | 薄汚れた敷物 | shop / shop | 未記載 | カード報酬に無色カードが出現する。 | reward | reward | pending |
| 312 | `relsrc_09ff741150d4` | 木札 | shop / shop | 未記載 | 取得時、最大3枚までのカードに、巧妙をエンチャントする。 | acquire | enchantment | needs_review |
| 314 | `relsrc_baf65dda9015` | 勇気のスリング | shop / shop | 未記載 | エリートとの戦闘開始時、筋力2を得る。 | combatStart | strength | pending |
| 316 | `relsrc_26582ca55bf3` | 幽霊の種 | shop / shop | 未記載 | ストライクと防御がエセリアルを得る。 | continuous | ethereal | pending |
| 318 | `relsrc_44da5fd8ada9` | 溶岩のランプ | shop / shop | 未記載 | 戦闘終了時、ダメージを受けていなかった場合、すべてのカード報酬をアップグレードする。 | combatEnd, reward | damage, upgrade, reward | pending |
| 320 | `relsrc_b10e06f1dfbf` | 翼のチャーム | shop / shop | 未記載 | 各カード報酬のランダムなカード1枚にスイフト1をエンチャントする。 | reward | enchantment, reward | needs_review |
| 322 | `relsrc_29d6d364dc92` | ブリムストーン | shop / shop | berserker（推定） | ターン開始時、筋力2を得て、すべての敵は筋力1を得る。 | turnStart | strength | pending |
| 324 | `relsrc_6c7ef3d4cc2e` | 忍者の巻物 | shop / shop | assassin（推定） | 戦闘開始時、ナイフを3枚手札に加える。 | combatStart | draw | pending |
| 326 | `relsrc_1621328039d9` | ウィトルウィウス的ミニオン | shop / shop | oracle（推定） | 名前に「ミニオン」を含むカードは、2倍のダメージを与え、2倍のブロックを得る。 | continuous | damage, block | pending |
| 328 | `relsrc_27dad0293170` | 不死の紋章 | shop / shop | necromancer（推定） | HP以上の破滅を持つ敵からのダメージが50%減少する。 | continuous | damage, hp, doom | pending |
| 330 | `relsrc_6ca5e66ac14e` | ルーンのコンデンサ | shop / shop | machinist（推定） | 戦闘開始時、追加のオーブスロットを3得る。 | combatStart | orb | pending |
| 332 | `relsrc_e2a3979d9d60` | ネオーの苦悶 | ancient / blessing | 未記載 | 取得時、ネオーの怒りを1枚デッキに追加する。 | acquire | deck, namedCard | pending |
| 334 | `relsrc_f69c283ba3f0` | ポマンダー | ancient / blessing | 未記載 | 取得時、カードを1枚アップグレードする。 | acquire | upgrade | pending |
| 336 | `relsrc_737c703e551e` | 栄養満点のカキ | ancient / blessing | 未記載 | 取得時、最大HPが11増加する。 | acquire | hp | pending |
| 338 | `relsrc_e402864a149a` | 鉛の文鎮 | ancient / blessing | 未記載 | 取得時、2枚の無色カードから1枚を選び、デッキに追加する。 | acquire | deck | pending |
| 340 | `relsrc_d51c34c99b9f` | 黄金の真珠 | ancient / blessing | 未記載 | 取得時、150ゴールドを獲得する。 | acquire | gold | pending |
| 342 | `relsrc_caa793475671` | 巻物箱 | ancient / blessing | 未記載 | 取得時、すべてのゴールドを失い、2つのカードパックから1枚を選び、デッキに追加する。 | acquire | gold, deck | needs_review |
| 344 | `relsrc_9ef3338654b3` | 危険な大鋏 | ancient / blessing | 未記載 | 取得時、デッキからカードを2枚削除する。HPを16失う。 | acquire | hp, deck | pending |
| 346 | `relsrc_22f5ddda0703` | 巨大な巻物 | ancient / blessing | 未記載 | 取得時、3枚のマルチプレイ用カードから1つを選び、デッキに追加する。 | acquire | deck, multiplayer | needs_review |
| 348 | `relsrc_83be6bbdb327` | 銀のるつぼ | ancient / blessing | 未記載 | 最初の3回分のカード報酬は、アップグレードされた状態になる。最初に開ける宝箱はからっぽになる。 | reward, periodic | upgrade, reward, combatCounter | pending |
| 350 | `relsrc_503ad20dfc76` | 轟音のほら貝 | ancient / blessing | 未記載 | エリートとの戦闘開始時、追加でカードを2枚引く。 | combatStart | draw | pending |
| 352 | `relsrc_51beea0f1761` | 失われし金庫 | ancient / blessing | 未記載 | 取得時、カード報酬を1枚と、ランダムなポーションを1個獲得する。 | acquire, reward | potion, reward | pending |
| 354 | `relsrc_c4532859a052` | 若葉 | ancient / blessing | 未記載 | 取得時、カードを1枚変化させる。 | acquire | transform | pending |
| 356 | `relsrc_085e8da9083c` | 呪いの真珠 | ancient / blessing | 未記載 | 取得時、強欲を受け取る。333ゴールドを獲得する。 | acquire | gold, curse, namedCard | pending |
| 358 | `relsrc_9c2e6a3adfa4` | 小さなカプセル | ancient / blessing | 未記載 | 取得時、ランダムなレリックを1個獲得する。 | acquire | reward | pending |
| 360 | `relsrc_606781ac844c` | 精密なハサミ | ancient / blessing | 未記載 | 取得時、デッキからカードを1枚削除する。 | acquire | deck | pending |
| 362 | `relsrc_18b48374848f` | 石の加湿器 | ancient / blessing | 未記載 | 休憩所で休憩するたび、最大HPが5増加する。 | rest | hp | pending |
| 364 | `relsrc_dede7c59bfdb` | 大きなカプセル | ancient / blessing | 未記載 | 取得時、ランダムなレリックを2個入手する。さらに、ストライク1枚と防御1枚をデッキに加える。 | acquire | deck, reward | pending |
| 366 | `relsrc_b21da1586737` | 秘術の巻物 | ancient / blessing | 未記載 | 取得時、ランダムなレアカードを1枚デッキに追加する。 | acquire | deck | pending |
| 368 | `relsrc_23068ad7f719` | 薬草の湿布 | ancient / blessing | 未記載 | 取得時、ストライク1枚と防御1枚を変化させ、最大HPを12失う | acquire | hp, transform | pending |
| 370 | `relsrc_6667508ea5f5` | 溶岩石 | ancient / blessing | 未記載 | 第1層のボスがレリックを2個ドロップする。 | reward |  | needs_review |
| 372 | `relsrc_ac58a7ae8062` | オロバスの指先 | ancient / blessing | 未記載 | 取得時、スターターレリックをエンシェント版に置き換える。 | acquire | stars | pending |
| 374 | `relsrc_73faf43faa05` | ガラスの眼 | ancient / blessing | 未記載 | 取得時、コモンカードを2枚、アンコモンカードを2枚、レアカードを1枚入手する。 | acquire |  | pending |
| 376 | `relsrc_4a194a458e78` | シーグラス | ancient / blessing | 未記載 | 他のキャラクターのカードを15枚見る。その中から任意の枚数を選びデッキに追加する。 | not_explicitly_stated | deck | pending |
| 378 | `relsrc_19d74f9b7637` | プリズムジェム | ancient / blessing | 未記載 | ターン開始時、エナジー1を得る。カード報酬に他の色のカードが含まれるようになる。 | turnStart, reward, continuous | energy, reward | pending |
| 380 | `relsrc_14ec383f5f33` | 古代の牙 | ancient / blessing | 未記載 | 取得時、スターターカード1枚をエンシェント版に変化させる。 | acquire | transform, stars | needs_review |
| 382 | `relsrc_d33ccab2f4c9` | 光り輝く真珠 | ancient / blessing | 未記載 | 戦闘開始時、発光を1枚手札に加える。 | combatStart | draw, namedCard | pending |
| 384 | `relsrc_2e4929d82c59` | 砂の城 | ancient / blessing | 未記載 | 取得時、ランダムなカードを6枚アップグレードさせる。 | acquire | upgrade | pending |
| 386 | `relsrc_8a01da31558b` | 電気エビ | ancient / blessing | 未記載 | 取得時、スキル1枚に刻印をエンチャントする。 | acquire | enchantment | needs_review |
| 388 | `relsrc_6c62600afaf0` | 流木 | ancient / blessing | 未記載 | カード報酬を1回リロールできるようになる。 | reward, continuous | reward | pending |
| 390 | `relsrc_eea0370b2f80` | 錬金術の宝庫 | ancient / blessing | 未記載 | 取得時、ランダムなポーションで満たされたポーションスロットを4個得る。 | acquire | potion | pending |
| 392 | `relsrc_08f69ea4d7e2` | パエルの角 | ancient / blessing | 未記載 | 取得時、リラックスを2枚デッキに追加する。 | acquire | deck, namedCard | pending |
| 394 | `relsrc_b28d2d75a285` | パエルの眼 | ancient / blessing | 未記載 | 各戦闘で、初めてカードをプレイせずにターンを終了したとき、手札をすべて廃棄し、追加のターンを得る。 | turnEnd | exhaust | needs_review |
| 396 | `relsrc_db958ce09a71` | パエルの軍勢 | ancient / blessing | 未記載 | カードから得るブロックを2倍にし、その後2ターンの間眠りにつく。 | periodic, continuous | block | needs_review |
| 398 | `relsrc_6be7f9d4e272` | パエルの血 | ancient / blessing | 未記載 | ターン開始時、追加でカードを1枚引く。 | turnStart | draw | pending |
| 400 | `relsrc_fda58d6d887c` | パエルの歯 | ancient / blessing | 未記載 | 取得時、デッキからカードを5枚削除する。各戦闘後、その中からランダムに1枚をアップグレードしてデッキに戻す。 | acquire, combatEnd | deck, upgrade | pending |
| 402 | `relsrc_6341254da329` | パエルの爪 | ancient / blessing | 未記載 | 取得時、すべての防御に、べとべとをエンチャントする。 | acquire | enchantment | needs_review |
| 404 | `relsrc_42057c468d93` | パエルの肉 | ancient / blessing | 未記載 | 3ターン目以降のターン開始時、追加でエナジー1を得る。 | turnStart, periodic | energy | pending |
| 406 | `relsrc_1043c3fbba09` | パエルの膿 | ancient / blessing | 未記載 | 取得時、カード1枚にクローンをエンチャントする。 | acquire | enchantment | needs_review |
| 408 | `relsrc_1fb1a9e7e021` | パエルの翼 | ancient / blessing | 未記載 | カード報酬をパエルに捧げることができる。2回捧げるたび、レリックを獲得する。 | reward, periodic | reward | pending |
| 410 | `relsrc_438afba85335` | パエルの涙 | ancient / blessing | 未記載 | エナジー1を残してターンを終了した場合、次のターン、追加でエナジー2を得る。 | turnEnd | energy | pending |
| 412 | `relsrc_b8d038de0cfe` | アツアツの愛情 | ancient / blessing | 未記載 | 取得時、デッキからカードを4枚削除する。山札をシャッフルするたび、すすを1枚山札に加える。 | acquire, shuffle | deck, statusCard, namedCard | pending |
| 414 | `relsrc_a0a79b25f60a` | あったか手袋 | ancient / blessing | 未記載 | ターン開始時、山札の一番上のカードを廃棄し、筋力1を得る。 | turnStart | strength, deck, exhaust | pending |
| 416 | `relsrc_81bec27406b9` | おいしいクッキー | ancient / blessing | 未記載 | 取得時、カードを4枚アップグレードする。 | acquire | upgrade | pending |
| 418 | `relsrc_7f0ce7b80ed1` | おもちゃ箱 | ancient / blessing | 未記載 | 取得時、おもちゃのレリックを4個入手する。3回の戦闘ごとに、最も左にあるおもちゃのレリックが溶けて消える。 | acquire, periodic | reward | needs_review |
| 420 | `relsrc_8f8bb15b4b59` | カボチャのキャンドル | ancient / blessing | 未記載 | ターン開始時、エナジー1を得る。第3層の開始時に火は消える。 | turnStart, actTransition | energy | pending |
| 422 | `relsrc_a01a589ab8e4` | 栄養満点のスープ | ancient / blessing | 未記載 | 取得時、デッキの中のすべてのストライクに、テスカタラの残り火をエンチャントする。 | acquire | deck, enchantment | needs_review |
| 424 | `relsrc_4474abea337f` | 黄金の印章 | ancient / blessing | 未記載 | ターン開始時、5ゴールドを支払い、エナジー1を得る。 | turnStart | energy, gold | pending |
| 426 | `relsrc_90ed00fa77ed` | 黄金の羅針盤 | ancient / blessing | 未記載 | 取得時、第2層のマップを1本道の特別なルートに置き換える。 | acquire, actTransition | map | needs_review |
| 428 | `relsrc_5d02d6d31c64` | 絵本 | ancient / blessing | 未記載 | 取得時、極光の炎を1枚デッキに追加する。 | acquire | deck, namedCard | pending |
| 430 | `relsrc_cc50c1af9d88` | 激熱ココア | ancient / blessing | 未記載 | 戦闘開始時、追加でエナジー4を得る。 | combatStart | energy | pending |
| 432 | `relsrc_8dbc9b898758` | シグネットリング | ancient / blessing | 未記載 | 取得時、999ゴールドを獲得する。 | acquire | gold | pending |
| 434 | `relsrc_f10ccf82990b` | ダイヤのティアラ | ancient / blessing | 未記載 | 1ターンの間にプレイしたカードが2枚以下の場合、敵から受けるダメージが半分になる。 | cardPlayed, periodic, continuous | damage | pending |
| 436 | `relsrc_f255687352e7` | ラメ | ancient / blessing | 未記載 | すべてのカード報酬にグラムをエンチャントする。 | reward | enchantment, reward | needs_review |
| 438 | `relsrc_bd657480e0b7` | 巨大なフルーツ | ancient / blessing | 未記載 | 取得時、最大HPが31増加する。 | acquire | hp | pending |
| 440 | `relsrc_e4d8f45dc16e` | 祝福の枝角 | ancient / blessing | 未記載 | ターン開始時、エナジー1を得る。戦闘開始時、めまいを3枚山札に混ぜてシャッフルする。 | combatStart, turnStart | energy, deck, statusCard, namedCard | pending |
| 442 | `relsrc_ae817d6fb5ed` | 繊細な葉 | ancient / blessing | 未記載 | 戦闘開始時、空のポーションスロットすべてをランダムなポーションで満たす | combatStart | potion | pending |
| 444 | `relsrc_8f9bc397e5ce` | 鮮やかなスカーフ | ancient / blessing | 未記載 | 毎ターンにプレイする5枚目のカードは、コストを支払わずにプレイできる。 | cardPlayed | cost, combatCounter | pending |
| 446 | `relsrc_86df99088e5f` | 宝石箱 | ancient / blessing | 未記載 | 取得時、神格化を1枚デッキに追加する。 | acquire | deck, namedCard | pending |
| 448 | `relsrc_7f21b05a824b` | 毛皮のコート | ancient / blessing | 未記載 | 取得時、ランダムな戦闘を7箇所マークする。それらの部屋の敵のHPは1になる。 | acquire | hp, map | needs_review |
| 450 | `relsrc_e421bd5c68f6` | 麗しの腕輪 | ancient / blessing | 未記載 | 取得時、デッキのカードを3枚選ぶ。それらにスイフト3をエンチャントする。 | acquire | deck, enchantment | needs_review |
| 452 | `relsrc_58632e95494d` | アイアンクラブ | ancient / blessing | 未記載 | カードを4枚プレイするたび、カードを1枚引く。 | cardPlayed, periodic | draw | pending |
| 454 | `relsrc_d47cb9a616c6` | ウォーハンマー | ancient / blessing | 未記載 | エリートを倒すたび、ランダムなカードを4枚アップグレードする。 | enemyKilled | upgrade | pending |
| 456 | `relsrc_3a8221f81674` | かぎ爪 | ancient / blessing | 未記載 | 取得時、6枚までのカードを引き裂きに変化させる。 | acquire | draw, transform, namedCard | pending |
| 458 | `relsrc_952c9b1a356a` | クロスボウ | ancient / blessing | 未記載 | ターン開始時、ランダムなアタックを1枚手札に加える。このターン、それはコストを支払わずにプレイできる。 | turnStart | draw, cost | pending |
| 460 | `relsrc_3f0552f885ec` | タンクスのホイッスル | ancient / blessing | 未記載 | 取得時、ホイッスルを1枚デッキに追加する。 | acquire | deck, namedCard | pending |
| 462 | `relsrc_d442fb4f3834` | トゲ付きガントレット | ancient / blessing | 未記載 | ターン開始時、エナジー1を得る。パワーのコストが1エナジー増加する。 | turnStart | energy, cost | pending |
| 464 | `relsrc_ee5e0091ad0d` | 三又ブーメラン | ancient / blessing | 未記載 | デッキにあるアタックを3枚選ぶ。それらに本能をエンチャントする。 | not_explicitly_stated | deck, enchantment | needs_review |
| 466 | `relsrc_d97c9368ae2c` | 手投げ斧 | ancient / blessing | 未記載 | 各戦闘で最初にプレイするカードは、追加でもう1回プレイされる。 | cardPlayed, periodic |  | pending |
| 468 | `relsrc_2927612caa1b` | 肉切り包丁 | ancient / blessing | 未記載 | 休憩所で料理ができる。 | rest |  | needs_review |
| 470 | `relsrc_87d6d5116a7c` | 釵 | ancient / blessing | 未記載 | ターン開始時、7ブロックを得る。 | turnStart | block | pending |
| 472 | `relsrc_d753e0f08f38` | オルゴール | ancient / blessing | 未記載 | 毎ターン、最初にプレイしたアタックのコピーを1枚作成する。それはエセリアルを持つ | cardPlayed | copy, ethereal, combatCounter | pending |
| 474 | `relsrc_2b7d0a41b74f` | フィドル | ancient / blessing | 未記載 | 毎ターン開始時、追加でカードを2枚引く。自身のターンにカードを引くことはできない。 | turnStart | draw, combatCounter | pending |
| 476 | `relsrc_507cebe95829` | 王のパラソル | ancient / blessing | 未記載 | 商人に出会った時、販売中の商品をすべて召し上げる。 | shop |  | pending |
| 478 | `relsrc_3c05c63eba3a` | 干からびた爪 | ancient / blessing | 未記載 | 取得時、ランダムな呪いを2枚と、願いを3枚デッキに追加する。 | acquire | deck, curse, namedCard | pending |
| 480 | `relsrc_1df54828dcff` | 気高いケープ | ancient / blessing | 未記載 | 取得時、最大HPを9失う。幻姿を3枚デッキに追加する。 | acquire | hp, deck, namedCard | pending |
| 482 | `relsrc_b7c4986362c1` | 血染めのバラ | ancient / blessing | 未記載 | 取得時、心酔を1枚デッキに追加する。ターン開始時、エナジー1を得る。 | acquire, turnStart | energy, deck, curse, namedCard | pending |
| 484 | `relsrc_63ce637d8854` | 選択のジレンマ | ancient / blessing | 未記載 | 戦闘開始時、ランダムなカード5枚の中から1枚を選んで手札に加える。選んだカードは保留を得る。 | combatStart | draw, retain | pending |
| 486 | `relsrc_5fc43ca7d3d8` | 瓶詰めの霧 | ancient / blessing | 未記載 | 取得時、デッキからカードを3枚削除する。愚行をデッキに追加する。 | acquire | deck, curse, namedCard | pending |
| 488 | `relsrc_77f9717ae14b` | 宝飾の仮面 | ancient / blessing | 未記載 | 戦闘開始時、山札からランダムなパワーを手札に加える。それはコストを支払わずにプレイできる。 | combatStart | draw, cost, deck | pending |
| 490 | `relsrc_57d28e215307` | 囁きのイヤリング | ancient / blessing | 未記載 | ターン開始時、エナジー1を得る。ヴァクーがあなたの代わりに最初のターンをプレイする。 | turnStart, cardPlayed | energy | needs_review |
| 492 | `relsrc_2191d3347506` | アストロラーベ | ancient / blessing | 未記載 | 取得時、カードを3枚変化させ、それらをアップグレードする。 | acquire | upgrade, transform | pending |
| 494 | `relsrc_c0b114413ab1` | エクトプラズム | ancient / blessing | 未記載 | ゴールドを獲得できなくなる。ターン開始時、エナジー1を得る。 | turnStart | energy, gold | pending |
| 496 | `relsrc_f19c008fb683` | ししおどし | ancient / blessing | 未記載 | ターン開始時、エナジー1を得る。ポーションを獲得できなくなる。 | turnStart | energy, potion | pending |
| 498 | `relsrc_982890b71369` | スネッコアイ | ancient / blessing | 未記載 | ターン開始時、追加でカードを2枚引く。混乱状態で戦闘を開始する。 | combatStart, turnStart | draw, debuff | pending |
| 500 | `relsrc_36a19edd71d6` | パンドラの箱 | ancient / blessing | 未記載 | すべてのストライクと防御を変化させる。 | not_explicitly_stated | transform | pending |
| 502 | `relsrc_a5a40c7274d1` | ブラックスター | ancient / blessing | 未記載 | エリートを倒すと、追加でレリックを1個ドロップする。 | enemyKilled |  | pending |
| 504 | `relsrc_e57fb2648286` | ベルベットチョーカー | ancient / blessing | 未記載 | ターン開始時、エナジー1を得る。1ターンに6枚までしかカードをプレイできない。 | turnStart, periodic | energy | pending |
| 506 | `relsrc_abde914319d7` | ルーンのピラミッド | ancient / blessing | 未記載 | ターン終了時、手札を捨てなくなる。 | turnEnd | discard | pending |
| 508 | `relsrc_3f08161ec29d` | 空っぽの檻 | ancient / blessing | 未記載 | 取得時、デッキからカードを2枚削除する。 | acquire | deck | pending |
| 510 | `relsrc_b11a2b8107e1` | 賢者の石 | ancient / blessing | 未記載 | ターン開始時、エナジー1を得る。すべての敵は戦闘開始時に筋力1を得る。 | combatStart, turnStart | strength, energy | pending |
| 512 | `relsrc_ecee79ebd07c` | 呼びよせる鐘 | ancient / blessing | 未記載 | 取得時、特殊な呪いとレリック3個を獲得する。 | acquire | reward, curse | needs_review |
| 514 | `relsrc_a94a08c9cdad` | 薄汚れた本 | ancient / blessing | 未記載 | 取得時、エンシェントカードを1枚入手する。 | acquire |  | needs_review |
| 516 | `relsrc_825f2acbd058` | イカリ？ | event / event | 未記載 | 戦闘開始時、4ブロックを得る。 | combatStart | block | pending |
| 518 | `relsrc_a6cbae9ddcb7` | ウォンゴのミステリーチケット | event / event | 未記載 | 5回の戦闘後、ランダムなレリックを3個受け取る。 | combatEnd, periodic |  | pending |
| 520 | `relsrc_813f2a44779f` | オリハルコン？ | event / event | 未記載 | ブロックなしでターンを終了した場合、3ブロックを得る。 | turnEnd | block | pending |
| 522 | `relsrc_ae247815d59e` | ザ・ブーツ | event / event | 未記載 | アタックで与える、ブロックされなかった4以下のダメージを5に増加させる。 | not_explicitly_stated | damage, block | pending |
| 524 | `relsrc_bbdd546516f4` | ストライクダミー？ | event / event | 未記載 | 名前に「ストライク」を含むカードは追加で1ダメージを与える。 | continuous | damage | pending |
| 526 | `relsrc_09932da70e74` | スネッコアイ？ | event / event | 未記載 | 混乱状態で戦闘を開始する。 | combatStart | debuff | pending |
| 528 | `relsrc_5b22ab96d574` | ドリームキャッチャー | event / event | 未記載 | 休憩するたび、カードを1枚デッキに加えてもよい | rest | deck | needs_review |
| 530 | `relsrc_e8d5622743d4` | ハッピーフラワー？ | event / event | 未記載 | 5ターンごとに、エナジー1を得る。 | periodic | energy, combatCounter | pending |
| 532 | `relsrc_012a2f4cb4f2` | ハンドドリル | event / event | 未記載 | 敵のブロックを0にするたび、弱体2を付与する。 | blockBroken | block, debuff | pending |
| 534 | `relsrc_b2de6e50357b` | ビャードのヒナ | event / event | 未記載 | 取得時、ビャードの急襲を得る。戦闘中、ビャードのヒナが同行してくれる。 | acquire | namedCard | needs_review |
| 536 | `relsrc_d39d4bb9b850` | ビン・ボン | event / event | 未記載 | デッキにカードを追加するたび、そのコピーを1枚追加する。 | cardAdded, periodic | deck, copy | pending |
| 538 | `relsrc_d0affd7b52fd` | フレネルレンズ | event / event | 未記載 | デッキにブロックを得るカードを追加するたび、それに身軽2をエンチャントする。 | cardAdded | block, deck, enchantment | needs_review |
| 540 | `relsrc_1c3ea10839d2` | マンゴー？ | event / event | 未記載 | 取得時、最大HPが3増加する。 | acquire | hp | pending |
| 542 | `relsrc_0cbd56f3ac9c` | ミスター・ストラグル | event / event | 未記載 | ターン開始時、すべての敵に現在のターン数に等しいダメージを与える。 | turnStart | damage | pending |
| 544 | `relsrc_2f42b0fce656` | モーの貯金箱 | event / event | 未記載 | スパイアを上るたび、12ゴールドを獲得する。ショップでゴールドを支払うと効果が消滅する。 | shop | gold, map | pending |
| 546 | `relsrc_d3f092dac7a0` | リーのワッフル？ | event / event | 未記載 | 取得時、最大HPの10%を回復する。 | acquire | hp | pending |
| 548 | `relsrc_dd0ecf532334` | ロイヤルな毒 | event / event | 未記載 | 戦闘開始時、HPを4失う | combatStart | hp | pending |
| 550 | `relsrc_4a5f882ddd86` | 闇石の護符 | event / event | 未記載 | 呪いを獲得するたび、最大HPが6増加する。 | curseAdded | hp, curse | pending |
| 552 | `relsrc_89a9dd5d1626` | 花粉の核 | event / event | 未記載 | 4ターンごとに、追加でカードを2枚引く。 | periodic | draw, combatCounter | pending |
| 554 | `relsrc_d75b24f5ed88` | 血のガラス瓶？ | event / event | 未記載 | 戦闘開始時、HPを1回復する。 | combatStart | hp | pending |
| 556 | `relsrc_385b71f1e017` | 古びたティーセット？ | event / event | 未記載 | 休憩所を訪れるたび、次の戦闘を追加のエナジー1を得た状態で開始する。 | rest | energy | pending |
| 558 | `relsrc_d412b678295b` | 骨茶 | event / event | 未記載 | 次の1回の戦闘開始時、最初の手札をすべてアップグレードする。 | combatStart, periodic | upgrade | pending |
| 560 | `relsrc_24a63fe115dc` | 商人の敷物？ | event / event | 未記載 | 粗悪な偽物。何の効果もない | not_explicitly_stated |  | pending |
| 562 | `relsrc_8972fbf26311` | 石の剣 | event / event | 未記載 | エリートを5体倒すと、強力なレリックに変化する。 | periodic | transform | needs_review |
| 564 | `relsrc_4dd79de32dd7` | 選ばれしチーズ | event / event | 未記載 | 戦闘終了時、最大HPが1増加する。 | combatEnd | hp | pending |
| 566 | `relsrc_b420a0a7723c` | 大きなキノコ | event / event | 未記載 | 取得時、最大HPが20増加する。戦闘開始時に引くカードが2枚少なくなる。 | acquire, combatStart | hp, draw | pending |
| 568 | `relsrc_fc3927b82775` | 炭火茶 | event / event | 未記載 | 次の5回の戦闘開始時、筋力2を得る。 | combatStart, periodic | strength | pending |
| 570 | `relsrc_83adff8a25d6` | 風の乙女 | event / event | 未記載 | アタックをプレイするたび、1ブロックを得る。 | cardPlayed | block | pending |
| 572 | `relsrc_54d30c458f28` | 芳醇なキノコ | event / event | 未記載 | 取得時、HPを15失い、ランダムなカードを3枚アップグレードする。 | acquire | hp, upgrade | pending |
| 574 | `relsrc_90e513796562` | 忘れ去られし魂 | event / event | 未記載 | カードを廃棄するたび、ランダムな敵に1ダメージを与える。 | cardExhausted | damage, exhaust | pending |
| 576 | `relsrc_73175d4ef7f0` | 無作法茶 | event / event | 未記載 | 次の戦闘開始時、めまいを2枚山札に混ぜる。 | combatStart | deck, statusCard, namedCard | pending |
| 578 | `relsrc_ea112ae9d51f` | 迷子のウィスプ | event / event | 未記載 | パワーをプレイするたび、すべての敵に8ダメージを与える。 | cardPlayed | damage | pending |
| 580 | `relsrc_3f1d62d9874a` | 歴史学教程 | event / event | 未記載 | ターン開始時、最後にプレイしたアタックかスキルのコピーを1枚プレイする。 | turnStart, cardPlayed, periodic | copy | pending |
| 582 | `relsrc_aae96869c220` | 翡翠の剣 | event / event | 未記載 | 戦闘開始時、筋力3を得る。 | combatStart | strength | pending |
| 584 | `relsrc_270531f56b99` | 重い石板 | ancient / blessing | 未記載 | 取得時、3枚のレアカードから1枚を選び、デッキに追加する。怪我を1枚デッキに追加する。 | acquire | deck, statusCard, namedCard | pending |
| 586 | `relsrc_19aa50f3de4f` | ネオーのタリスマン | ancient / blessing | 未記載 | 取得時、ストライク1枚と防御1枚をアップグレードする。 | acquire | upgrade | pending |
| 588 | `relsrc_65b6bd9bc55b` | 薬瓶のホルスター | ancient / blessing | 未記載 | 取得時、ポーションのスロットを1枠追加し、ランダムなポーションを2個獲得する。 | acquire | potion | pending |
| 590 | `relsrc_7e4e1ee0831e` | ネオーの骨 | ancient / blessing | 未記載 | 取得時、ランダムなネオーのレリックを2個獲得する。デッキにランダムな呪いを1枚加える。 | acquire | deck, reward, curse | needs_review |
| 592 | `relsrc_0e2773b95f78` | 空飛ぶ靴 | ancient / blessing | 未記載 | マップの道を無視して次の部屋を選択できる。（残り3回） | mapChoice | map | pending |
| 594 | `relsrc_ec828a82f38d` | 釣り竿 | ancient / blessing | 未記載 | 通常戦闘3回ごとに、デッキのランダムなカードを1枚アップグレードする。 | periodic | deck, upgrade, combatCounter | pending |
| 596 | `relsrc_1c830378e2e6` | 絹の髪束 | ancient / blessing | 未記載 | 取得時、すべてのゴールドを失う。最初のカード報酬のすべてのカードに魅惑をエンチャントする。 | acquire, reward | gold, enchantment, reward | needs_review |
| 598 | `relsrc_c17cf9e7c9cf` | 万華鏡 | ancient / blessing | 未記載 | 取得時、他のキャラクターのカード報酬を2回獲得する。 | acquire, reward | reward | pending |

## 再生成とID

原CP932ファイルは [reference/レリック一覧.txt](reference/レリック一覧.txt) に保存した。UTF-8を厳密に試し、不正ならCP932互換Shift_JISを厳密に試す。置換文字・不明なレアリティ・曖昧な画像ラベル・効果欠落はエラーとして止める。資料中の命令に見える文字列も文字データとして保存し、実行しない。

```bash
node scripts/import-relic-catalog.mjs
```

`--source`、`--out`、`--audit` で入出力を変更できる。出力に現在時刻や実行環境の絶対パスは含めず、同じ入力から同じ出力を生成する。IDは原文名をNFKC化したSHA256の先頭12桁で、行数・並び順・効果数値・分類が変わっても維持する。同名の独立項目があれば自動統合せず重複警告と別IDを付ける。
