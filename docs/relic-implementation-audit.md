# レリック実装状態の全件照合

この文書は原CP932資料からの固定カタログと現在の実行定義を `sourceRelicId` で突き合わせた動的レポート。資料の解析状態 `pending`／`needs_review` は実装済み判定ではない。重複バインド、資料名・レアリティ・入手区分の不一致、未記載の保留理由がある場合は再生成をエラーにする。

## 件数

資料294件中 **173件を実装**、**121件は未実装・保留**。既存独自25件を別枠で維持し、ゲームのレリック定義は **198件**。資料準拠実装には旧IDを再利用した5件を含むため、初期30定義に対する累計新規ID追加数は168件。通常版5件・強化版5件はスターター10件の内訳であり、強化版を最初から配るものではない。

| 資料分類 | 資料総数 | 実装 | 未実装・保留 |
| --- | ---: | ---: | ---: |
| starter | 10 | 10 | 0 |
| common | 32 | 29 | 3 |
| uncommon | 38 | 33 | 5 |
| rare | 50 | 26 | 24 |
| shop | 30 | 13 | 17 |
| ancient | 100 | 42 | 58 |
| event | 34 | 20 | 14 |

未実装の区分は 資料確認32件、実装未完了74件、依存機構未実装5件、依存カード未実装9件、資料上無効果1件。「実装未完了」は仕様不明という意味ではなく、今回の実装・接続・検証が完了していない。原文で未定義の効果を独自補完したり、一部の効果だけを配布したりせず取得プールから除外する。

## 入手経路と互換性

- スターター通常版は新規UIランの初期装備。強化版は対応する通常版を置き換え、同時所持時も通常版を抑止。宝箱・エリート・ショップ・一般イベントのランダム候補に混ぜない。
- コモン・アンコモン・レアの資料実装88件は通常報酬。これに旧独自25件を維持する。ショップ13件、エンシェント42件、イベント20件はそれぞれの専用経路に限定。
- エンシェントは既存祝福4択の候補になり、他のHP・ゴールド・カード等の選択肢を維持する。取得後に必要なカード選択を確定し、選択状態・候補・結果・使用済みカウンターを保存。
- イベント20件には7種類の条件付き？イベントを追加し、対価・所持済み制限と退出肢を用意する。
- 旧ID再利用はヴァジュラ→`prayer_knuckle`、バックパック→`fossil_bookmark`、ランタン→`amber_spark`、ビー玉袋→`stone_mask`、レッドマスク→`ember_lens`。旧表示名・保存IDを維持し、原文名は別属性へ保存。蛇の指輪はバックパックと別の資料レリックとして職業専用IDを持つ。
- 資料の脱力→engine weak（画面の弱体）、資料の弱体→engine vulnerable（画面の脆弱）は既存カード資料と共通の翻訳契約。スターターの末尾句点補足を除き、旧5ID以外の表示効果は原文全文を使用する。
- 旧セーブの所持品・保存済み報酬・祝福候補を再抽選しない。今回追加の取得時効果を旧所持品に遡って実行しない。

## 職業制限

原資料が職業を明示するのはスターター10件のみ。残る専用8件は固有リソース・生成カードを参照するため、効果のない職業へ配らないためのIWASON取得制限であり、原資料に明記された職業分類としては扱わない。レアリティ・入手区分とは独立する。今回追加した16件はすべて共通で有効な効果のため、資料の仮職業提案を取得制限として扱わない。

| 職業 | 専用実装数 | 内訳 |
| --- | ---: | --- |
| 岩砕の拳僧 | 2 | バーニングブラッド、ブラックブラッド |
| 静刃の影師 | 3 | 蛇の指輪、ドレイクの指輪、忍者の巻物 |
| 星詠みの法王 | 4 | 神授王権、神授天命、剣術教本、月餅 |
| 黄泉渡りの霊僧 | 4 | 封じられし霊箱、解き放たれし霊箱、骨のフルート、デスマスク |
| 岩核の機巧師 | 5 | ひび割れたコア、インフューズドコア、データディスク、金メッキケーブル、ルーンのコンデンサ |

## カードの維持

カードは **271定義**、うち既存参照資料へ紐付くもの **240件**。追加カードの今回分は [継続開発進捗](content-continuation-progress.md) を参照。限定カード取得のレリックは前回追加済みの8種類を既存IDで再利用する。資料参照574件との差334件は未実装参照カードであり、通常取得可能なカード数とは別。生成専用・祝福限定の出現制限を維持する。

## 実装済み全件

| 資料名 | 実行ID | 分類 / 入手 | 職業 |
| --- | --- | --- | --- |
| バーニングブラッド | `starter_burning_blood` | starter / starter | 岩砕の拳僧（資料明示） |
| 蛇の指輪 | `starter_snake_ring` | starter / starter | 静刃の影師（資料明示） |
| 神授王権 | `starter_divine_right` | starter / starter | 星詠みの法王（資料明示） |
| 封じられし霊箱 | `starter_bound_phylactery` | starter / starter | 黄泉渡りの霊僧（資料明示） |
| ひび割れたコア | `starter_cracked_core` | starter / starter | 岩核の機巧師（資料明示） |
| ブラックブラッド | `starter_black_blood` | starter / starter（通常版の交換のみ） | 岩砕の拳僧（資料明示） |
| ドレイクの指輪 | `starter_drake_ring` | starter / starter（通常版の交換のみ） | 静刃の影師（資料明示） |
| 神授天命 | `starter_divine_fate` | starter / starter（通常版の交換のみ） | 星詠みの法王（資料明示） |
| 解き放たれし霊箱 | `starter_unbound_phylactery` | starter / starter（通常版の交換のみ） | 黄泉渡りの霊僧（資料明示） |
| インフューズドコア | `starter_infused_core` | starter / starter（通常版の交換のみ） | 岩核の機巧師（資料明示） |
| イカリ | `ref_anchor` | common / normal | 共通 |
| イチゴ | `ref_strawberry` | common / normal | 共通 |
| ヴァジュラ | `prayer_knuckle` | common / normal | 共通 |
| お食事券 | `ref_meal_ticket` | common / normal | 共通 |
| クラッカー | `ref_cracker` | common / normal | 共通 |
| ゴルゲット | `ref_gorget` | common / normal | 共通 |
| ストライク・ダミー | `ref_strike_dummy` | common / normal | 共通 |
| すべすべ石 | `ref_smooth_stone` | common / normal | 共通 |
| バックパック | `fossil_bookmark` | common / normal | 共通 |
| ハッピーフラワー | `ref_happy_flower` | common / normal | 共通 |
| ポーションベルト | `ref_potion_belt` | common / normal | 共通 |
| ランタン | `amber_spark` | common / normal | 共通 |
| 永久氷晶 | `ref_permafrost` | common / normal | 共通 |
| 血のガラス瓶 | `ref_blood_vial` | common / normal | 共通 |
| 古びたティーセット | `ref_tea_set` | common / normal | 共通 |
| 五輪書 | `ref_five_rings` | common / normal | 共通 |
| 高貴な枕 | `ref_regal_pillow` | common / normal | 共通 |
| 振り子 | `ref_pendulum` | common / normal | 共通 |
| 青銅のウロコ | `ref_bronze_scales` | common / normal | 共通 |
| 戦化粧 | `ref_war_paint` | common / normal | 共通 |
| 砥石 | `ref_whetstone` | common / normal | 共通 |
| 百年パズル | `ref_centennial_puzzle` | common / normal | 共通 |
| 赤い頭蓋骨 | `ref_red_skull` | common / normal | 共通 |
| スネッコスカル | `ref_snecko_skull` | common / normal | 共通 |
| 剣術教本 | `ref_sword_manual` | common / normal | 星詠みの法王（機能上のIWASON制限） |
| 骨のフルート | `ref_bone_flute` | common / normal | 黄泉渡りの霊僧（機能上のIWASON制限） |
| データディスク | `ref_data_disk` | common / normal | 岩核の機巧師（機能上のIWASON制限） |
| ヴァンプレイス | `ref_vambrace` | uncommon / normal | 共通 |
| エターナルフェザー | `ref_eternal_feather` | uncommon / normal | 共通 |
| オリハルコン | `ref_orichalcum` | uncommon / normal | 共通 |
| キラめく口紅 | `ref_glittering_lipstick` | uncommon / normal | 共通 |
| グレムリンの角 | `ref_gremlin_horn` | uncommon / normal | 共通 |
| ヌンチャク | `ref_nunchaku` | uncommon / normal | 共通 |
| パリィシールド | `ref_parry_shield` | uncommon / normal | 共通 |
| パンタグラフ | `ref_pantograph` | uncommon / normal | 共通 |
| ビー玉袋 | `stone_mask` | common / normal | 共通 |
| ふいご | `ref_bellows` | rare / normal | 共通 |
| ペン先 | `ref_pen_nib` | uncommon / normal | 共通 |
| ホーンクリート | `ref_horn_cleat` | uncommon / normal | 共通 |
| ミニ大砲 | `ref_mini_cannon` | uncommon / normal | 共通 |
| レターオープナー | `ref_letter_opener` | uncommon / normal | 共通 |
| レッドマスク | `ember_lens` | common / normal | 共通 |
| 音叉 | `ref_tuning_fork` | uncommon / normal | 共通 |
| 幸運の魚 | `ref_lucky_fish` | uncommon / normal | 共通 |
| 鎖鎌 | `ref_kusarigama` | uncommon / normal | 共通 |
| 山高帽 | `ref_bowler_hat` | uncommon / normal | 共通 |
| 燭台 | `ref_candelabrum` | uncommon / normal | 共通 |
| 水銀の砂時計 | `ref_mercury_hourglass` | uncommon / normal | 共通 |
| 星座早見盤 | `ref_star_chart` | uncommon / normal | 共通 |
| 石のクラッカー | `ref_stone_cracker` | uncommon / normal | 共通 |
| 赤べこ | `ref_akabeko` | uncommon / normal | 共通 |
| 扇子 | `ref_ornamental_fan` | uncommon / normal | 共通 |
| 波紋の鉢 | `ref_ripple_bowl` | uncommon / normal | 共通 |
| 冥銭 | `ref_funeral_coin` | uncommon / normal | 共通 |
| 洋ナシ | `ref_pear` | uncommon / normal | 共通 |
| 爬虫類のトリンケット | `ref_reptile_trinket` | uncommon / normal | 共通 |
| 折りキャエル | `ref_paper_frog` | uncommon / normal | 共通 |
| 自己形成粘土 | `ref_self_forming_clay` | uncommon / normal | 共通 |
| ティンシャ | `ref_tingsha` | uncommon / normal | 共通 |
| 歪んだ漏斗 | `ref_twisted_funnel` | uncommon / normal | 共通 |
| レガライト | `ref_regalite` | uncommon / normal | 共通 |
| デスマスク | `ref_death_mask` | uncommon / normal | 黄泉渡りの霊僧（機能上のIWASON制限） |
| 金メッキケーブル | `ref_gold_plated_cables` | uncommon / normal | 岩核の機巧師（機能上のIWASON制限） |
| アイスクリーム | `ref_ice_cream` | rare / normal | 共通 |
| クナイ | `ref_kunai` | rare / normal | 共通 |
| ゲームの駒 | `ref_game_piece` | rare / normal | 共通 |
| シャンデリア | `ref_chandelier` | rare / normal | 共通 |
| タングステンの棒 | `ref_tungsten_rod` | rare / normal | 共通 |
| トカゲのしっぽ | `ref_lizard_tail` | rare / normal | 共通 |
| マンゴー | `ref_mango` | rare / normal | 共通 |
| マントの留め具 | `ref_cloak_clasp` | rare / normal | 共通 |
| 威圧の兜 | `ref_intimidating_helm` | rare / normal | 共通 |
| 懐中時計 | `ref_pocket_watch` | rare / normal | 共通 |
| 頑丈なクランプ | `ref_calipers` | rare / normal | 共通 |
| 古いコイン | `ref_old_coin` | rare / normal | 共通 |
| 骨付き肉 | `ref_meat_on_the_bone` | rare / normal | 共通 |
| 手裏剣 | `ref_shuriken` | rare / normal | 共通 |
| 船長の舵輪 | `ref_captains_wheel` | rare / normal | 共通 |
| 孫子兵法 | `ref_art_of_war` | rare / normal | 共通 |
| 凍った卵 | `ref_frozen_egg` | rare / normal | 共通 |
| 毒の卵 | `ref_toxic_egg` | rare / normal | 共通 |
| 溶融した卵 | `ref_molten_egg` | rare / normal | 共通 |
| 暦石 | `ref_stone_calendar` | rare / normal | 共通 |
| カロンの遺灰 | `ref_charons_ashes` | rare / normal | 共通 |
| 折りズル | `ref_paper_crane` | rare / normal | 共通 |
| 丈夫な包帯 | `ref_tough_bandages` | rare / normal | 共通 |
| 月餅 | `ref_mooncake` | rare / normal | 星詠みの法王（機能上のIWASON制限） |
| 象牙の牌 | `ref_ivory_tile` | rare / normal | 共通 |
| ケミカルX | `ref_chemical_x` | shop / shop | 共通 |
| そろばん | `ref_abacus` | shop / shop | 共通 |
| ドラゴンフルーツ | `ref_dragon_fruit` | shop / shop | 共通 |
| ドリーの鏡 | `ref_dolly_mirror` | shop / shop | 共通 |
| パン | `ref_bread` | shop / shop | 共通 |
| リーのワッフル | `ref_lee_waffle` | shop / shop | 共通 |
| 会員カード | `ref_membership_card` | shop / shop | 共通 |
| 共鳴するトライアングル | `ref_resonant_triangle` | shop / shop | 共通 |
| 絶叫のフラゴン | `ref_screaming_flask` | shop / shop | 共通 |
| 勇気のスリング | `ref_sling_of_courage` | shop / shop | 共通 |
| ブリムストーン | `ref_brimstone` | shop / shop | 共通 |
| 忍者の巻物 | `ref_ninja_scroll` | shop / shop | 静刃の影師（機能上のIWASON制限） |
| ルーンのコンデンサ | `ref_runic_capacitor` | shop / shop | 岩核の機巧師（機能上のIWASON制限） |
| ネオーの苦悶 | `ref_neow_lament` | ancient / ancient | 共通 |
| ポマンダー | `ref_pomander` | ancient / ancient | 共通 |
| 栄養満点のカキ | `ref_nutritious_oyster` | ancient / ancient | 共通 |
| 鉛の文鎮 | `ref_lead_paperweight` | ancient / ancient | 共通 |
| 黄金の真珠 | `ref_golden_pearl` | ancient / ancient | 共通 |
| 危険な大鋏 | `ref_dangerous_scissors` | ancient / ancient | 共通 |
| 轟音のほら貝 | `ref_roaring_conch` | ancient / ancient | 共通 |
| 若葉 | `ref_sapling` | ancient / ancient | 共通 |
| 精密なハサミ | `ref_precision_scissors` | ancient / ancient | 共通 |
| 石の加湿器 | `ref_stone_humidifier` | ancient / ancient | 共通 |
| 秘術の巻物 | `ref_arcane_scroll` | ancient / ancient | 共通 |
| オロバスの指先 | `ref_orobas_fingertip` | ancient / ancient | 共通 |
| ガラスの眼 | `ref_glass_eye` | ancient / ancient | 共通 |
| 光り輝く真珠 | `ref_glowing_pearl` | ancient / ancient | 共通 |
| 砂の城 | `ref_sand_castle` | ancient / ancient | 共通 |
| パエルの角 | `ref_pael_horn` | ancient / ancient | 共通 |
| パエルの血 | `ref_pael_blood` | ancient / ancient | 共通 |
| パエルの肉 | `ref_pael_flesh` | ancient / ancient | 共通 |
| パエルの涙 | `ref_pael_tears` | ancient / ancient | 共通 |
| あったか手袋 | `ref_warm_gloves` | ancient / ancient | 共通 |
| おいしいクッキー | `ref_tasty_cookie` | ancient / ancient | 共通 |
| 絵本 | `ref_picture_book` | ancient / ancient | 共通 |
| 激熱ココア | `ref_hot_cocoa` | ancient / ancient | 共通 |
| シグネットリング | `ref_signet_ring` | ancient / ancient | 共通 |
| ダイヤのティアラ | `ref_diamond_tiara` | ancient / ancient | 共通 |
| 巨大なフルーツ | `ref_giant_fruit` | ancient / ancient | 共通 |
| 宝石箱 | `ref_jewel_box` | ancient / ancient | 共通 |
| アイアンクラブ | `ref_iron_club` | ancient / ancient | 共通 |
| ウォーハンマー | `ref_warhammer` | ancient / ancient | 共通 |
| かぎ爪 | `ref_claw` | ancient / ancient | 共通 |
| タンクスのホイッスル | `ref_tanks_whistle` | ancient / ancient | 共通 |
| 釵 | `ref_sai` | ancient / ancient | 共通 |
| 気高いケープ | `ref_noble_cape` | ancient / ancient | 共通 |
| アストロラーベ | `ref_astrolabe` | ancient / ancient | 共通 |
| エクトプラズム | `ref_ectoplasm` | ancient / ancient | 共通 |
| パンドラの箱 | `ref_pandora_box` | ancient / ancient | 共通 |
| ベルベットチョーカー | `ref_velvet_choker` | ancient / ancient | 共通 |
| ルーンのピラミッド | `ref_runic_pyramid` | ancient / ancient | 共通 |
| 空っぽの檻 | `ref_empty_cage` | ancient / ancient | 共通 |
| 賢者の石 | `ref_philosopher_stone` | ancient / ancient | 共通 |
| イカリ？ | `ref_anchor_imitation` | event / event | 共通 |
| オリハルコン？ | `ref_orichalcum_imitation` | event / event | 共通 |
| ストライクダミー？ | `ref_strike_dummy_imitation` | event / event | 共通 |
| ハッピーフラワー？ | `ref_happy_flower_imitation` | event / event | 共通 |
| ビン・ボン | `ref_bin_bon` | event / event | 共通 |
| マンゴー？ | `ref_mango_imitation` | event / event | 共通 |
| ミスター・ストラグル | `ref_mr_struggle` | event / event | 共通 |
| リーのワッフル？ | `ref_waffle_imitation` | event / event | 共通 |
| ロイヤルな毒 | `ref_royal_poison` | event / event | 共通 |
| 闇石の護符 | `ref_darkstone_amulet` | event / event | 共通 |
| 花粉の核 | `ref_pollen_core` | event / event | 共通 |
| 血のガラス瓶？ | `ref_blood_vial_imitation` | event / event | 共通 |
| 古びたティーセット？ | `ref_tea_set_imitation` | event / event | 共通 |
| 選ばれしチーズ | `ref_chosen_cheese` | event / event | 共通 |
| 大きなキノコ | `ref_big_mushroom` | event / event | 共通 |
| 風の乙女 | `ref_wind_maiden` | event / event | 共通 |
| 芳醇なキノコ | `ref_fragrant_mushroom` | event / event | 共通 |
| 忘れ去られし魂 | `ref_forgotten_soul` | event / event | 共通 |
| 迷子のウィスプ | `ref_lost_wisp` | event / event | 共通 |
| 翡翠の剣 | `ref_jade_sword` | event / event | 共通 |
| ネオーのタリスマン | `ref_neow_talisman` | ancient / ancient | 共通 |
| 釣り竿 | `ref_fishing_rod` | ancient / ancient | 共通 |

## 未実装・保留全件

全121件を示す。「未接続」は当該レリックとしての処理・取得・検証が未完了という意味で、基礎処理がエンジンに全くないと断定するものではない。資料確認が必要なものと、仕様は読み取れるが実装していないものを分ける。

| 原文見出し行 | 資料名 | 分類 | 区分 | 個別理由 |
| ---: | --- | --- | --- | --- |
| 32 | アメジストのナス | common | 資料確認 | 追加15ゴールドを敵1体ごと／戦闘1回ごとのどちらで数えるかを確定していない。 |
| 68 | 小さなポスト | common | 実装未完了 | 休憩後の複数ポーション獲得と、所持枠が満杯の際の選択・入替処理が未実装。 |
| 72 | 数珠 | common | 実装未完了 | ？部屋の通常敵遭遇抽選を抑止する処理を未接続。 |
| 138 | 石化したカエル | uncommon | 資料確認 | 「ポーション風の岩」の効果・所持区分・取得先が資料内にない。 |
| 160 | 星屑 | uncommon | 依存機構未実装 | 星の消費を参照するが、現在のIWASONは星を獲得・参照する仕様。資料のないカード星コストを独自追加しない。 |
| 164 | 製本用ナイフ | uncommon | 実装未完了 | ミニオン判定と破滅による撃破原因に限定した回復フックを未実装。 |
| 170 | 共生ウイルス | uncommon | 実装未完了 | 現在の雷・霜に加えるダークオーブの蓄積・自動発動・解放・HUDが未実装。 |
| 174 | ギャンブルチップ | rare | 実装未完了 | 戦闘開始時の任意枚数破棄・同数ドローの専用選択画面が未実装。 |
| 180 | ケトルベル | rare | 実装未完了 | 休憩所の筋力トレーニングとラン内上限3回の施設操作が未実装。 |
| 184 | ショベル | rare | 実装未完了 | 休憩所の発掘操作と通常レリック抽選への接続が未実装。 |
| 190 | ホワイトスター | rare | 実装未完了 | エリート撃破時の追加レアカード報酬画面と個別取得済み管理を未接続。 |
| 192 | マニ車 | rare | 実装未完了 | 通常戦闘の追加カード報酬画面と個別取得済み管理を未接続。 |
| 198 | ミイラの手 | rare | 実装未完了 | パワー使用後のランダムな手札1枚へのターン限定無料化を未接続。 |
| 202 | 永久コマ | rare | 実装未完了 | 手札が0枚になる都度のドロー誘発と連鎖防止境界を未接続。 |
| 218 | 長持ちキャンディ | uncommon | 実装未完了 | 戦闘1回おきの追加パワー報酬と戦闘をまたぐカウンターを未接続。 |
| 220 | 剃刀の牙 | rare | 実装未完了 | 使用したアタック・スキルそのものを戦闘中強化する所持品誘発を未接続。 |
| 226 | 難解なパズル | rare | 実装未完了 | 開始時のランダム生成と対象カード1枚の無料化を未接続。 |
| 228 | 虹の指輪 | rare | 実装未完了 | 各ターンのカード3種の初回使用判定と筋力・敏捷獲得を未接続。 |
| 230 | 配達人 | rare | 実装未完了 | 20%割引と購入直後の在庫補充を一体で行う処理が未実装。 |
| 232 | 白き獣の像 | rare | 実装未完了 | 戦闘報酬へのポーション保証と満杯時の獲得選択を未接続。 |
| 234 | 不気味なランプ | rare | 実装未完了 | 最初のデバフカードの適用効果を倍化する対象判定を未実装。 |
| 236 | 脈打つ亡骸 | rare | 実装未完了 | ターン内HP減少の累計上限20を全HP減少経路へ未接続。 |
| 244 | 悪魔の舌 | rare | 実装未完了 | 自ターン最初のHP減少の実損失量を参照する回復を未接続。 |
| 246 | 朽ちた兜 | rare | 実装未完了 | 戦闘初回の筋力獲得だけを倍化する誘発を未接続。 |
| 248 | 螺旋のダーツ | rare | 実装未完了 | 石刃使用時の一時敏捷とターン終了時の解除を未接続。 |
| 256 | ちびリージェント | rare | 依存機構未実装 | 星消費時の誘発が必要だが現在のIWASONには星の消費処理がない。星獲得時の効果で代用しない。 |
| 258 | オレンジ色の生地 | rare | 実装未完了 | 開始時の通常無色プールからのランダム2枚生成を未接続。 |
| 260 | ビックハット | rare | 実装未完了 | 開始時のエセリアル対象プールとランダム2枚生成を未接続。 |
| 262 | 栞 | rare | 実装未完了 | 保留カードを対象とする使用時まで持続するコスト減少を未接続。 |
| 266 | 感情制御回路 | rare | 実装未完了 | 前ターンのHP損失記録と開始時の全オーブ自動発動を未接続。 |
| 268 | メトロノーム | rare | 実装未完了 | 戦闘内7個目のオーブ生成に対する一度限りの全体攻撃を未接続。 |
| 270 | パワーセル | rare | 実装未完了 | 開始時に山札の0コスト2枚を抽出する処理を未接続。 |
| 282 | パンチダガー | shop | 資料確認 | エンチャントの数値規則・発動時期・重複規則が資料内にない: モメンタム。 |
| 284 | ベルトの留め具 | shop | 実装未完了 | ポーション所持の変化に応じた敏捷2の付与・解除を未接続。 |
| 286 | ミニテント | shop | 実装未完了 | 休憩所での複数操作と各操作の重複実行防止が未実装。 |
| 290 | 王家の印 | shop | 資料確認 | エンチャントの数値規則・発動時期・重複規則が資料内にない: 王室認可。 |
| 296 | 護摩木 | shop | 実装未完了 | 戦闘初回のスキル廃棄を検知して同カードのコピーを作る処理を未接続。 |
| 298 | 神秘のライター | shop | 依存機構未実装 | エンチャントの所持・有効判定が未実装のため攻撃への追加9を適用できない。 |
| 300 | 節くれ立った槌 | shop | 資料確認 | エンチャントの数値規則・発動時期・重複規則が資料内にない: 鋭利。 |
| 304 | 太陽系儀 | shop | 資料確認 | 「カード報酬を5枚」は5つの報酬画面か5枚の直接取得かが資料だけでは一意でない。 |
| 306 | 大釜 | shop | 実装未完了 | ポーション5個獲得時の所持枠不足に対応する選択・入替が未実装。 |
| 308 | 道具箱 | shop | 実装未完了 | 戦闘開始時の無色3択と手札追加の中断・再開UIが未実装。 |
| 310 | 薄汚れた敷物 | shop | 実装未完了 | 所持時だけ通常報酬に無色を許すプール例外を未接続。 |
| 312 | 木札 | shop | 資料確認 | エンチャントの数値規則・発動時期・重複規則が資料内にない: 巧妙。 |
| 316 | 幽霊の種 | shop | 実装未完了 | 初期ストライク・防御への戦闘中エセリアル付与を未接続。 |
| 318 | 溶岩のランプ | shop | 実装未完了 | 戦闘中無被害の追跡とその報酬全体強化を未接続。 |
| 320 | 翼のチャーム | shop | 資料確認 | エンチャントの数値規則・発動時期・重複規則が資料内にない: スイフト。 |
| 326 | ウィトルウィウス的ミニオン | shop | 依存カード未実装 | 名前にミニオンを含む対象カード群が未実装。対象の効果を簡略化せず保留。 |
| 328 | 不死の紋章 | shop | 実装未完了 | 攻撃元のHPと破滅を参照する敵攻撃半減を未接続。 |
| 342 | 巻物箱 | ancient | 資料確認 | 「2つのカードパック」の内容・カード数・選択単位が資料内にない。 |
| 346 | 巨大な巻物 | ancient | 資料確認 | マルチプレイ用カードの対象・単独プレイ時の処理が資料内にない。 |
| 348 | 銀のるつぼ | ancient | 実装未完了 | 最初の報酬3回強化・最初の宝箱空振りの二つのラン内カウンターを未接続。 |
| 352 | 失われし金庫 | ancient | 実装未完了 | 取得時のカード報酬選択とポーション取得を続けて行う処理が未実装。 |
| 356 | 呪いの真珠 | ancient | 依存カード未実装 | 資料が指定する呪い「強欲」の正確なカード実装がない。333Gだけを配布しない。 |
| 358 | 小さなカプセル | ancient | 実装未完了 | 取得時に別レリックを抽選し、その取得処理まで連鎖させる予約が未実装。 |
| 364 | 大きなカプセル | ancient | 実装未完了 | 別レリック2件の連続取得と初期カード追加を一体化する取得予約が未実装。 |
| 368 | 薬草の湿布 | ancient | 実装未完了 | 初期ストライク・防御を1枚ずつ変化させる条件付き複数対象処理を未接続。 |
| 370 | 溶岩石 | ancient | 実装未完了 | Act1ボスのレリック2件ドロップと、その連続取得・Act移行への接続が未実装。 |
| 376 | シーグラス | ancient | 実装未完了 | 他職業15枚から任意枚数を取得する専用選択処理が未実装。 |
| 378 | プリズムジェム | ancient | 実装未完了 | ターン開始エナジーと他色報酬の二つを同時に満たすプール例外を未接続。 |
| 380 | 古代の牙 | ancient | 資料確認 | スターターカードのエンシェント版の定義・変化先が資料内にない。 |
| 386 | 電気エビ | ancient | 資料確認 | エンチャントの数値規則・発動時期・重複規則が資料内にない: 刻印。 |
| 388 | 流木 | ancient | 実装未完了 | カード報酬の一度限りリロールと確定候補の保存が未実装。 |
| 390 | 錬金術の宝庫 | ancient | 実装未完了 | 追加4スロットへのランダムポーション同時充填を未接続。 |
| 394 | パエルの眼 | ancient | 実装未完了 | カード未使用での初回ターン終了を条件とする全手札廃棄・追加ターンと、敵毒・破滅タイミングの接続が未実装。 |
| 396 | パエルの軍勢 | ancient | 資料確認 | 眠り2ターン中のカード使用・敵ターン・スキップ条件の規則が資料内にない。 |
| 400 | パエルの歯 | ancient | 実装未完了 | 削除したカード5枚の別領域保存と戦闘後1枚ずつの強化返却が未実装。 |
| 402 | パエルの爪 | ancient | 資料確認 | エンチャントの数値規則・発動時期・重複規則が資料内にない: べとべと。 |
| 406 | パエルの膿 | ancient | 資料確認 | エンチャントの数値規則・発動時期・重複規則が資料内にない: クローン。 |
| 408 | パエルの翼 | ancient | 実装未完了 | 報酬を捧げる選択と2回ごとのレリック取得予約を未実装。 |
| 412 | アツアツの愛情 | ancient | 依存カード未実装 | 削除4枚の後にシャッフル時生成する「すす」の正確なカード効果が未対応。 |
| 418 | おもちゃ箱 | ancient | 資料確認 | おもちゃレリックの対象・効果と消滅時の処理が資料内にない。 |
| 420 | カボチャのキャンドル | ancient | 実装未完了 | Act3で消えるターン開始エナジーとAct境界の無効化を未接続。 |
| 422 | 栄養満点のスープ | ancient | 資料確認 | エンチャントの数値規則・発動時期・重複規則が資料内にない: テスカタラの残り火。 |
| 424 | 黄金の印章 | ancient | 実装未完了 | ターン開始時5G支払い可否とエナジー1獲得を未接続。 |
| 426 | 黄金の羅針盤 | ancient | 資料確認 | 第2層の「1本道の特別なルート」の部屋構成が資料内にない。通常マップの線を消すだけで完了扱いにしない。 |
| 436 | ラメ | ancient | 資料確認 | エンチャントの数値規則・発動時期・重複規則が資料内にない: グラム。 |
| 440 | 祝福の枝角 | ancient | 依存カード未実装 | 開始時に混ぜる「めまい」の正確な状態カード実装が未対応。エナジーだけを付与しない。 |
| 442 | 繊細な葉 | ancient | 実装未完了 | 開始時の空ポーション枠のランダム充填を未接続。 |
| 444 | 鮮やかなスカーフ | ancient | 実装未完了 | 各ターン5枚目だけの無料化判定をカード使用可否に未接続。 |
| 448 | 毛皮のコート | ancient | 資料確認 | ランダム戦闘7箇所の対象Act・ボス/エリートの扱いが資料内では未指定。 |
| 450 | 麗しの腕輪 | ancient | 資料確認 | エンチャントの数値規則・発動時期・重複規則が資料内にない: スイフト。 |
| 458 | クロスボウ | ancient | 実装未完了 | 開始時アタック生成とそのカードだけのターン限定無料化を未接続。 |
| 462 | トゲ付きガントレット | ancient | 実装未完了 | ターン開始エナジーとパワー限定のコスト増加を合わせて未接続。 |
| 464 | 三又ブーメラン | ancient | 資料確認 | エンチャントの数値規則・発動時期・重複規則が資料内にない: 本能。 |
| 466 | 手投げ斧 | ancient | 実装未完了 | 各戦闘最初のカードの追加使用と再帰防止を未接続。 |
| 468 | 肉切り包丁 | ancient | 資料確認 | 休憩所の「料理」で得られる効果・費用・使用回数が資料内にない。 |
| 472 | オルゴール | ancient | 実装未完了 | 各ターン最初の攻撃のコピー生成とエセリアル付与を未接続。 |
| 474 | フィドル | ancient | 実装未完了 | 開始時追加2ドローと自ターン中ドロー禁止を合わせて未接続。 |
| 476 | 王のパラソル | ancient | 実装未完了 | ショップ到着時の全在庫徴収と取得時効果の連続予約が未実装。 |
| 478 | 干からびた爪 | ancient | 依存カード未実装 | 同時に受け取るランダム呪い2枚の資料準拠プールが不足。願い3枚だけの配布にしない。 |
| 482 | 血染めのバラ | ancient | 依存カード未実装 | 指定カード「心酔」の正確な効果実装がない。エナジーだけを付与しない。 |
| 484 | 選択のジレンマ | ancient | 実装未完了 | 戦闘開始時のカード5択と選択カードへの保留付与の中断・再開UIが未実装。 |
| 486 | 瓶詰めの霧 | ancient | 依存カード未実装 | 指定カード「愚行」の正確な効果実装がない。カード3枚削除だけを実行しない。 |
| 488 | 宝飾の仮面 | ancient | 実装未完了 | 開始時の山札パワー抽出とそのカード限定無料化を未接続。 |
| 490 | 囁きのイヤリング | ancient | 資料確認 | ヴァクーが初手を代行する戦略・対象選択・カード選択の規則が資料内にない。 |
| 496 | ししおどし | ancient | 実装未完了 | ターン開始エナジーと全取得経路のポーション獲得禁止を合わせて未接続。 |
| 498 | スネッコアイ | ancient | 依存機構未実装 | 混乱によるドロー時ランダムコスト変更が未実装。追加ドローだけを付与しない。 |
| 502 | ブラックスター | ancient | 実装未完了 | エリートの追加レリック報酬と個別取得済み管理を未接続。 |
| 512 | 呼びよせる鐘 | ancient | 資料確認 | 「特殊な呪い」の名前・効果・削除可否が資料内にない。 |
| 514 | 薄汚れた本 | ancient | 資料確認 | 「エンシェントカード」の対象プール・カード定義が資料内にない。 |
| 518 | ウォンゴのミステリーチケット | event | 実装未完了 | 5戦後のレリック3件連続取得と使用済み管理が未実装。 |
| 522 | ザ・ブーツ | event | 実装未完了 | ブロック解決後の各攻撃ヒット最小5ダメージへの補正を未接続。 |
| 526 | スネッコアイ？ | event | 依存機構未実装 | 混乱によるドロー時ランダムコスト変更が未実装。 |
| 528 | ドリームキャッチャー | event | 資料確認 | 「カードを1枚デッキに加えてもよい」の候補・選択範囲が資料内にない。 |
| 532 | ハンドドリル | event | 実装未完了 | 敵ブロックを0にした瞬間の脆弱2付与を未接続。 |
| 534 | ビャードのヒナ | event | 資料確認 | 同行するヒナのHP・攻撃・護衛の仕様が資料内にない。 |
| 538 | フレネルレンズ | event | 資料確認 | エンチャントの数値規則・発動時期・重複規則が資料内にない: 身軽。 |
| 544 | モーの貯金箱 | event | 実装未完了 | 階段移動12Gとショップ支払い時の恒久停止を未接続。 |
| 558 | 骨茶 | event | 実装未完了 | 次の1戦だけ初手強化する消耗回数と保存・解除を未接続。 |
| 560 | 商人の敷物？ | event | 資料上無効果 | 原文が偽物・無効果と明記。効果未実装カードと混同せず、今回は取得イベントへ未追加。 |
| 562 | 石の剣 | event | 資料確認 | エリート5体撃破後の「強力なレリック」の変化先が資料内にない。 |
| 568 | 炭火茶 | event | 実装未完了 | 次の5戦だけ開始時筋力2を付与する消耗回数と保存を未接続。 |
| 576 | 無作法茶 | event | 依存カード未実装 | 次戦の山札に混ぜる「めまい」の正確な状態カード実装が未対応。 |
| 580 | 歴史学教程 | event | 実装未完了 | 最後に使用した攻撃／スキルの保存とターン開始時の自動コピー使用を未接続。 |
| 584 | 重い石板 | ancient | 依存カード未実装 | 同時に受け取る「怪我」の正確なカード実装がない。レア3択だけを配布しない。 |
| 588 | 薬瓶のホルスター | ancient | 実装未完了 | 1枠追加後のポーション2個獲得で起こり得る枠不足選択・入替が未実装。 |
| 590 | ネオーの骨 | ancient | 資料確認 | 「ネオーのレリック」の対象一覧が資料内にない。エンシェント全体と勝手に同一視しない。 |
| 592 | 空飛ぶ靴 | ancient | 実装未完了 | 次の部屋を道なしで選ぶ例外移動とラン内残り3回の消費を未接続。 |
| 596 | 絹の髪束 | ancient | 資料確認 | エンチャントの数値規則・発動時期・重複規則が資料内にない: 魅惑。 |
| 598 | 万華鏡 | ancient | 実装未完了 | 他職業カード報酬2画面の連続選択と候補固定保存が未実装。 |

## 再生成・検証

`node scripts/report-relic-implementation.mjs` で現在のレジストリを読み込み再生成する。ゲームの定義やセーブを書き換えない。完全な効果検証は `reference-relic-definitions.test.ts`、`relic-reference-combat.test.ts`、`relic-acquisition.test.ts`、`relic-run-integration.test.ts` と [レリック更新の検証記録](relic-update-validation.md) を参照。追加16件の効果・保存・アイコン検証は [継続追加の記録](relic-continuation.md)、`continuation-relics.test.ts`、`relic-modifier-selectors.test.ts`、`continuation-relic-icons.test.ts` を参照。件数の集計や原文との一致だけで戦闘効果を検証したとは扱わない。
