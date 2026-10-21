# 追加カードの実装・未実装監査

2026-10-21更新。集計元は `sourceCards.generated.json`（参考資料574件）と、ゲームが実際に使用する `CARD_DEFINITIONS` です。通常版と強化版は同じカードIDの2状態であり、2枚として数えません。参考資料の `pending` / `needs_review` は資料の点検状態であり、実装状態ではありません。

今回の継続追加は **42種類**。全件、資料の通常・強化効果とコストを実装し、通常取得可能な職業専用または無色カードとして登録しました。新規モジュールは `continuationMartialCards.ts`（14件）、`continuationMysticCards.ts`（12件）、`continuationArcaneCards.ts`（16件）。既存カードのID・効果・取得区分は維持します。

**現在は参照付き240種類、未実装資料334種類、実行可能レジストリ全体271種類**です。参照付き240種類には初期攻撃・防御10種類、生成専用3種類、祝福限定8種類を含み、通常の取得候補は219種類です。レジストリ全体には、別に既存のIWASON独自カード30種類・呪い1種類を含みます。

| 所属 | 資料件数 | 今回の追加 | 参照付き実装 | うち通常取得候補 | うち生成専用 | うち祝福限定 | 未実装資料 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 岩砕の拳僧 | 88 | 6 | 40 | 38 | 0 | 0 | 48 |
| 静刃の影師 | 89 | 8 | 39 | 36 | 1 | 0 | 50 |
| 星詠みの法王 | 92 | 6 | 42 | 39 | 1 | 0 | 50 |
| 黄泉渡りの霊僧 | 90 | 6 | 43 | 40 | 1 | 0 | 47 |
| 岩核の機巧師 | 89 | 6 | 40 | 38 | 0 | 0 | 49 |
| 無色・共通 | 126 | 10 | 36 | 28 | 0 | 8 | 90 |
| 合計 | 574 | 42 | 240 | 219 | 3 | 8 | 334 |

通常取得候補は `isNormalAcquisitionCard` の結果です。初期デッキ専用のストライク・防御は通常区分でも報酬候補へ含めません。無色カードは通常区分でも職業の戦闘報酬へ出現せず、従来どおりショップ・許可されたイベント等で取得します。

履歴：ランダムマップ更新（`51974c9`）で104種類を追加し、当時の参照付き実装は190種類でした。続く祝福限定8種類の追加後は198種類、今回42種類の追加後は240種類です。祝福限定の原文・通常／強化・安定ID・取得区分は [祝福限定カード監査](blessing-card-audit.md) を参照してください。

## 用語・データの根拠

- 添付TXTに種別とレアリティの列はありません。追加カードの種別は攻撃・防御・持続効果の内容から設定し、レアリティはゲーム内の抽選とバランスのための仮設定です。全追加カードに `metadataProvisional: true` を保持します。公式の種別・レアリティと断定しません。
- 今回の追加では、資料の「脱力」をエンジンの `weak`（画面表示「弱体」、与ダメージ0.75倍）、資料の「弱体」を `vulnerable`（画面表示「脆弱」、被ダメージ1.5倍）に対応させます。両方が記載されたカードは別の状態異常として処理します。以前からのカード定義には遡及変更しません。
- 通常・強化コストは `createReferenceCard` が正規化前の資料コスト欄と照合します。Xは消費したエナジーを参照します。星コストの欠落をエナジー欄から推測しません。
- 表示名はIWASON SPIRE向けの独自名に変更し、内部IDと安定した `sourceCardId` を分離します。資料の行番号・原文は元JSONに保持します。
- 条件付き攻撃、ランダム対象、Xの攻撃回数、一時的な筋力・パワー、次ターン処理、手札交換・選択を共通エンジンで解決します。二次効果や制限を取り除いてカード数を増やす実装は行いません。

## 今回追加した42種類（2026-10-21）

通常・強化のコストは資料を直接参照します。種別・レアリティは資料に記載がないためIWASON用の仮設定です。個別の効果・境界条件と検証は [拳僧・影師の追加記録](card-continuation-martial.md) および各追加テストを参照してください。

| 所属 | 資料名 | IWASON表示名 | 内部ID | 資料ID | 通常→強化コスト |
| --- | --- | --- | --- | --- | --- |
| 岩砕の拳僧 | ヘッドバット | 石頭の再提出 | `berserker_headbutt` | `src_berserker_d3f6b736cb5a` | 1→1 |
| 岩砕の拳僧 | 不屈の闘志 | 捨て身の石選び | `berserker_true_grit` | `src_berserker_b80a35592635` | 1→1 |
| 岩砕の拳僧 | アッパーカット | 天井までほいっと | `berserker_uppercut` | `src_berserker_305c3da9b2a9` | 2→2 |
| 岩砕の拳僧 | 切り刻み | 今夜は腕を休めよ | `berserker_disarm_strike` | `src_berserker_1ce48661f0b6` | 3→3 |
| 岩砕の拳僧 | 焼印 | 血判の入信届 | `berserker_brand` | `src_berserker_3ef83d355614` | 0→0 |
| 岩砕の拳僧 | ストーンアーマー | 着る石垣 | `berserker_stone_armor` | `src_berserker_2f3a4fcd9ffe` | 1→1 |
| 静刃の影師 | 金切り声 | 静かにしてくだ砕 | `assassin_piercing_wail` | `src_assassin_ee31d86751f2` | 1→1 |
| 静刃の影師 | 略奪 | 明朝の手札を拝借 | `assassin_predator` | `src_assassin_d5e317a7f434` | 2→2 |
| 静刃の影師 | 暗器 | 袖の中の石庫 | `assassin_hidden_arsenal` | `src_assassin_651686748908` | 0→0 |
| 静刃の影師 | 足払い | 足元からじっと | `assassin_leg_sweep` | `src_assassin_724568294541` | 2→2 |
| 静刃の影師 | 無限の刃 | 毎朝届く石刃便 | `assassin_infinite_blades` | `src_assassin_f2a0cb211d75` | 1→1 |
| 静刃の影師 | 暗殺 | 夜明け前の石仕事 | `assassin_assassinate` | `src_assassin_8706b99776e3` | 0→0 |
| 静刃の影師 | 機先 | 一足お先にじっと | `assassin_anticipation` | `src_assassin_8096b7beacc7` | 0→0 |
| 静刃の影師 | フットワーク | 小刻みな無動 | `assassin_footwork` | `src_assassin_c89e62a48458` | 1→1 |
| 星詠みの法王 | 重圧 | 星岩の重たい説法 | `oracle_gravitational_pressure` | `src_oracle_3c09a98b2dca` | 1→1 |
| 星詠みの法王 | 星の終わり | 終業の流星礼 | `oracle_stars_end` | `src_oracle_831a88617285` | 1→1 |
| 星詠みの法王 | 小盾の展開 | 星盾の礼拝支度 | `oracle_buckler_deploy` | `src_oracle_6400e9b98133` | 1→1 |
| 星詠みの法王 | テラフォーミング | 祭壇の地ならし | `oracle_terraform` | `src_oracle_47d708a8af0c` | 1→1 |
| 星詠みの法王 | 権威の体現 | 教祖の懐札 | `oracle_embodied_authority` | `src_oracle_f6f2a4966e16` | 1→1 |
| 星詠みの法王 | 思いがけぬ贈り物 | 石包みの差し入れ | `oracle_unexpected_gift` | `src_oracle_dea75c784fc8` | 1→1 |
| 黄泉渡りの霊僧 | 虚脱の魔手 | 黄泉からの肩もみ | `necromancer_exhausting_hand` | `src_necromancer_77b9aab8f2f7` | 1→1 |
| 黄泉渡りの霊僧 | フレンドシップ | 腕組み相互扶助 | `necromancer_friendship` | `src_necromancer_e0170347c1ae` | 1→1 |
| 黄泉渡りの霊僧 | 力の吸収 | 墓石の力うつし | `necromancer_strength_absorption` | `src_necromancer_d781c83a71a4` | 1→1 |
| 黄泉渡りの霊僧 | 浄化 | 黄泉路の片づけ | `necromancer_purification` | `src_necromancer_caa038872424` | 1→1 |
| 黄泉渡りの霊僧 | 逃げ場なし | 黄泉路の通行止め | `necromancer_no_escape` | `src_necromancer_642f222b0df2` | 1→1 |
| 黄泉渡りの霊僧 | 霊魂抽出 | 彼岸の魂くみ | `necromancer_spirit_extraction` | `src_necromancer_b7d917f44d33` | 1→1 |
| 岩核の機巧師 | 爪 | 岩爪の反復研磨 | `machinist_claw` | `src_machinist_d1c746228453` | 0→0 |
| 岩核の機巧師 | 避雷針 | 二朝の避雷塔 | `machinist_lightning_rod` | `src_machinist_910541bba3ac` | 1→1 |
| 岩核の機巧師 | 認知偏向 | 明日のことは明日の回路 | `machinist_biased_cognition` | `src_machinist_095e4f54daca` | 1→1 |
| 岩核の機巧師 | コンデンサ | 岩核の増設架台 | `machinist_capacitor` | `src_machinist_f5bec0037fad` | 1→1 |
| 岩核の機巧師 | テスラコイル | 岩核の雷束ね | `machinist_tesla_coil` | `src_machinist_87c8c178d07c` | 0→0 |
| 岩核の機巧師 | 冷却材 | 多相の冷却祈祷 | `machinist_coolant` | `src_machinist_2cea0659cd7b` | 1→1 |
| 無色・共通 | 連射 | 石つぶての乱射 | `colorless_barrage` | `src_colorless_710ac08c69af` | X→X |
| 無色・共通 | 闇の足枷 | 岩影の足枷 | `colorless_dark_shackles` | `src_colorless_a7907f75d9ff` | 0→0 |
| 無色・共通 | 先読み(無色) | 石板の先読み | `colorless_forethought` | `src_colorless_4c5355ee4466` | 0→0 |
| 無色・共通 | 裂傷 | 弱点へ刻む石傷 | `colorless_lacerate` | `src_colorless_ce4be24d8fd3` | 2→2 |
| 無色・共通 | 走り書き | 教祖の全力速記 | `colorless_scrawl` | `src_colorless_3e188aa9c523` | 1→1 |
| 無色・共通 | 狂奔 | うききの跳弾 | `colorless_frenzy` | `src_colorless_b1a9885fb89b` | 1→1 |
| 無色・共通 | フードファイト | 朝飯前の怪力 | `colorless_food_fight` | `src_colorless_3dd1d1dc7f47` | 0→0 |
| 無色・共通 | 円環の障壁 | 三朝の岩環 | `colorless_circular_barrier` | `src_colorless_0d6cd5a0b338` | 2→2 |
| 無色・共通 | 武勇 | 岩尊の文武両道 | `colorless_valor` | `src_colorless_136474622e99` | 1→1 |
| 無色・共通 | 不滅の鎧 | 幾重の不動岩鎧 | `colorless_immortal_armor` | `src_colorless_016b8b340749` | 3→3 |

## 過去の104種類追加（51974c9）

| 所属 | 資料名 | IWASON表示名 | 内部ID | 資料ID | 通常→強化コスト |
| --- | --- | --- | --- | --- | --- |
| 岩砕の拳僧 | 強打 | 岩戸のひび割り | `berserker_bash` | `src_berserker_1587f4965407` | 2→2 |
| 岩砕の拳僧 | サンダークラップ | 全山への拍手 | `berserker_thunderclap` | `src_berserker_63ab80fffd05` | 1→1 |
| 岩砕の拳僧 | 血路を開く | 自腹の開山式 | `berserker_blood_path` | `src_berserker_ba490f14709c` | 1→1 |
| 岩砕の拳僧 | 身震い | 震える御神体 | `berserker_shiver` | `src_berserker_4af611adde8f` | 1→1 |
| 岩砕の拳僧 | 血の壁 | 血判の石垣 | `berserker_blood_wall` | `src_berserker_1d02fd3787fa` | 2→2 |
| 岩砕の拳僧 | 挑発 | 動かぬ煽り | `berserker_taunt` | `src_berserker_ac0b7c317fe3` | 1→1 |
| 岩砕の拳僧 | 脳天割り | 教祖の大落石 | `berserker_skull_crush` | `src_berserker_79fedc3a0560` | 3→3 |
| 岩砕の拳僧 | 破砕 | 一枚岩の破門状 | `berserker_shatter` | `src_berserker_78f37e69bd64` | 1→1 |
| 岩砕の拳僧 | ソードブーメラン | 投げても戻る岩拳 | `berserker_boomerang` | `src_berserker_825fe9df705a` | 1→1 |
| 岩砕の拳僧 | 旋風刃 | 岩尊大回転 | `berserker_whirlwind` | `src_berserker_1daf9f7b3f92` | X→X |
| 岩砕の拳僧 | アッシュストライク | 灰岩の追い拳 | `berserker_ash_strike` | `src_berserker_ac4aa1ecc772` | 1→1 |
| 岩砕の拳僧 | ごろつき | ひび割れ追及班 | `berserker_bully` | `src_berserker_5751575f6dd6` | 0→0 |
| 岩砕の拳僧 | 解体 | 割れ目に二礼 | `berserker_dismantle` | `src_berserker_363def480b9c` | 1→1 |
| 岩砕の拳僧 | 黒焦げ | 焦土の正拳 | `berserker_char` | `src_berserker_64907d31d58b` | 2→2 |
| 岩砕の拳僧 | セットアップストライク | 次の拳への祈り | `berserker_setup_strike` | `src_berserker_34a7cd3a9e40` | 1→1 |
| 岩砕の拳僧 | 炎の障壁 | 熱々の御神体 | `berserker_flame_barrier` | `src_berserker_799398661703` | 2→2 |
| 岩砕の拳僧 | 激怒 | 腕組みの憤り | `berserker_rage` | `src_berserker_ab98dbce40b0` | 0→0 |
| 岩砕の拳僧 | かがり火 | 朝まで燃える石灯 | `berserker_bonfire` | `src_berserker_4ec90a87503f` | 2→2 |
| 静刃の影師 | 無力化 | 影師の寝かしつけ | `assassin_neutralize` | `src_assassin_026b2b29be67` | 0→0 |
| 静刃の影師 | 五月雨ダガー | 小石の夕立 | `assassin_dagger_spray` | `src_assassin_d77a0e3ee32e` | 1→1 |
| 静刃の影師 | 不意打ち | 背後からほいっと | `assassin_sneak_attack` | `src_assassin_f86b76436d79` | 1→1 |
| 静刃の影師 | ディフレクト | 影のいなし | `assassin_deflect` | `src_assassin_acf9e557fc9f` | 0→0 |
| 静刃の影師 | 蛇の噛みつき | 毒蛇の石牙 | `assassin_serpent_bite` | `src_assassin_7ee3055bd276` | 2→2 |
| 静刃の影師 | 騙し討ち | 朝一番の裏挨拶 | `assassin_backstab` | `src_assassin_01e25bf56632` | 0→0 |
| 静刃の影師 | ダッシュ | 影渡りの肘打ち | `assassin_dash` | `src_assassin_bfe2378536bb` | 2→2 |
| 静刃の影師 | 抑圧 | 朝礼は逃がさない | `assassin_oppress` | `src_assassin_5d50597af08a` | 0→0 |
| 静刃の影師 | 串刺し | 影師の串岩 | `assassin_skewer` | `src_assassin_921de57406d2` | X→X |
| 静刃の影師 | 研ぎ澄まされた刃 | 手ぶらの石刃師 | `assassin_focused_blade` | `src_assassin_496383d006c3` | 0→0 |
| 静刃の影師 | バブル・バブル | 毒壺の二度づけ | `assassin_bubble` | `src_assassin_41734a216544` | 1→1 |
| 静刃の影師 | 職人技 | 影師の手際 | `assassin_expertise` | `src_assassin_0789a6748d02` | 1→1 |
| 静刃の影師 | 蜃気楼 | 毒霞の岩壁 | `assassin_mirage` | `src_assassin_537ea444d602` | 1→0 |
| 静刃の影師 | ドッジ＆ロール | 今朝と明朝の受け身 | `assassin_dodge_roll` | `src_assassin_79a298021b5d` | 1→1 |
| 静刃の影師 | イカサマ | 袖の下の朝活札 | `assassin_gamble` | `src_assassin_758830accaf9` | 0→0 |
| 無色・共通 | 生産 | 石からエナジー | `colorless_production` | `src_colorless_d05b8087ce19` | 0→0 |
| 無色・共通 | ビャードの急襲 | 鳥岩の飛び込み | `colorless_bird_charge` | `src_colorless_bfb40e566401` | 0→0 |
| 無色・共通 | ついばみ | 小石の三拍子 | `colorless_peck` | `src_colorless_4ff355648719` | 1→1 |
| 無色・共通 | 駆除 | 境内の大清掃 | `colorless_exterminate` | `src_colorless_3cda328ec118` | 1→1 |
| 無色・共通 | 踏み潰し | 門前の踏み固め | `colorless_trample` | `src_colorless_c2a344b0774a` | 1→1 |
| 無色・共通 | 先読み | 明日の朝活予約 | `colorless_foresight` | `src_colorless_8194aa41e6fe` | 1→1 |
| 無色・共通 | まきびし | 境内の尖り石 | `colorless_caltrops` | `src_colorless_4e0d7e611270` | 1→1 |
| 無色・共通 | 発光 | 懐の琥珀電池 | `colorless_glow` | `src_colorless_4eca65aeb198` | 0→0 |
| 無色・共通 | 衝撃波 | 全山じっと令 | `colorless_shockwave` | `src_colorless_ce0a017d40f9` | 2→2 |
| 無色・共通 | マインドブラスト | 積み石の念波 | `colorless_mind_blast` | `src_colorless_e13aa191f43a` | 1→0 |
| 無色・共通 | スタック | 積み残した石垣 | `colorless_stack` | `src_colorless_340ecc5d5f10` | 1→1 |
| 無色・共通 | 塹壕 | 石垣をもう一周 | `colorless_entrench` | `src_colorless_35311cd0b563` | 2→1 |
| 星詠みの法王 | 落星 | 小隕石の説法 | `oracle_falling_star` | `src_oracle_d8952ca15aba` | 0→0 |
| 星詠みの法王 | 星霊の波動 | 星岩の大波 | `oracle_stellar_wave` | `src_oracle_a8e4da2cbd39` | 0→0 |
| 星詠みの法王 | 身の程を知れ | 教祖の静かな一喝 | `oracle_know_your_place` | `src_oracle_e1f123c2321d` | 0→0 |
| 星詠みの法王 | 星の外套 | 星屑の法衣 | `oracle_star_cloak` | `src_oracle_3e654c1c4554` | 0→0 |
| 星詠みの法王 | ガンマブラスト | 御光の照射 | `oracle_gamma_blast` | `src_oracle_5ed2420662db` | 0→0 |
| 星詠みの法王 | 撃滅 | 岩尊の裁き | `oracle_annihilate` | `src_oracle_202af4c8ad32` | 1→1 |
| 星詠みの法王 | 覇権 | 星空の朝番 | `oracle_hegemony` | `src_oracle_8aa7c1c9f384` | 2→2 |
| 星詠みの法王 | ロイヤルギャンブル | 九星の賽 | `oracle_royal_gamble` | `src_oracle_a89909519a80` | 0→0 |
| 星詠みの法王 | 共鳴 | 岩壁の共振 | `oracle_resonance` | `src_oracle_b78fb98ce927` | 1→1 |
| 星詠みの法王 | 彗星 | 教祖、彗星に乗る | `oracle_comet` | `src_oracle_866fcfdcd329` | 0→0 |
| 星詠みの法王 | セブンスターズ | 七曜の連岩 | `oracle_seven_stars` | `src_oracle_8f1c78815371` | 2→1 |
| 星詠みの法王 | 流星群 | 満天の石ころ | `oracle_meteor_shower` | `src_oracle_7d9ba2d01c14` | 0→0 |
| 星詠みの法王 | 導きの星 | 朝星の道案内 | `oracle_guiding_star` | `src_oracle_9466bda3ee1f` | 1→1 |
| 星詠みの法王 | 隠し財産 | 星壺のへそくり | `oracle_hidden_wealth` | `src_oracle_f6467645194b` | 1→1 |
| 星詠みの法王 | 輝き | 明け方の御光 | `oracle_glimmer` | `src_oracle_8b0aa094735f` | 1→1 |
| 星詠みの法王 | 煌めく激流 | 銀河の岩戸 | `oracle_glittering_torrent` | `src_oracle_b3e86ae72f6d` | 2→2 |
| 星詠みの法王 | フォトンカット | 光岩の切り札 | `oracle_photon_cut` | `src_oracle_378984cfd4ad` | 1→1 |
| 星詠みの法王 | 微光 | 灯明の石読み | `oracle_faint_light` | `src_oracle_bb610284c699` | 1→1 |
| 星詠みの法王 | 宇宙的無関心 | 宇宙規模のじっと | `oracle_cosmic_indifference` | `src_oracle_8c384e9b0d05` | 1→1 |
| 星詠みの法王 | ヘブンリードリル | 天穿つ岩錐 | `oracle_heavenly_drill` | `src_oracle_e48c0dd361e1` | X→X |
| 黄泉渡りの霊僧 | 畏怖 | 彼岸の眼光 | `necromancer_dread` | `src_necromancer_4a7ca30d9f60` | 1→1 |
| 黄泉渡りの霊僧 | 反抗 | 岩戸の拒絶 | `necromancer_defiance` | `src_necromancer_6a3f05181870` | 1→1 |
| 黄泉渡りの霊僧 | ヘイト稼ぎ | 岩霊の見栄 | `necromancer_provoke` | `src_necromancer_d07717ee4b9f` | 2→2 |
| 黄泉渡りの霊僧 | ハイタッチ | 彼岸の肩叩き | `necromancer_high_five` | `src_necromancer_dc7e9685bff7` | 2→2 |
| 黄泉渡りの霊僧 | 分霊 | 魂の三叉路 | `necromancer_split_soul` | `src_necromancer_9dca23be0e7f` | 2→2 |
| 黄泉渡りの霊僧 | 埋葬 | 墓石の一撃 | `necromancer_entomb` | `src_necromancer_0e22c3e40218` | 4→4 |
| 黄泉渡りの霊僧 | 化膿 | 黄泉苔の種 | `necromancer_fester` | `src_necromancer_f4300ee46831` | 1→1 |
| 黄泉渡りの霊僧 | 解析 | 魂の読経 | `necromancer_analyze` | `src_necromancer_fbff7b5046d9` | 1→1 |
| 黄泉渡りの霊僧 | ディレイ | 冥府の順番待ち | `necromancer_delay` | `src_necromancer_7ce34c1e68a9` | 2→2 |
| 黄泉渡りの霊僧 | デスブリンガー | 彼岸からのお迎え | `necromancer_deathbringer` | `src_necromancer_c12883e4e681` | 2→2 |
| 黄泉渡りの霊僧 | 骨の軍団 | 石骨の隊列 | `necromancer_bone_army` | `src_necromancer_48dbf403a246` | 2→2 |
| 黄泉渡りの霊僧 | 運命共同体 | 同じ墓の仲 | `necromancer_common_fate` | `src_necromancer_e2262e09462d` | 0→0 |
| 黄泉渡りの霊僧 | 不死 | 何度でも座禅 | `necromancer_immortality` | `src_necromancer_81686c6ccf01` | 0→0 |
| 黄泉渡りの霊僧 | 彼方への一瞥 | 彼岸の回覧板 | `necromancer_beyond_glimpse` | `src_necromancer_93342f3567c0` | 1→1 |
| 黄泉渡りの霊僧 | 蘇生 | 岩霊の朝帰り | `necromancer_resurrection` | `src_necromancer_06d297b14ffb` | 3→3 |
| 黄泉渡りの霊僧 | 祈祷 | 明日の霊番 | `necromancer_prayer` | `src_necromancer_c69185351f9c` | 1→1 |
| 黄泉渡りの霊僧 | 領域 | 彼岸の朝活会場 | `necromancer_domain` | `src_necromancer_6cf282941d33` | 3→2 |
| 黄泉渡りの霊僧 | 根絶 | 黄泉の連石葬 | `necromancer_eradicate` | `src_necromancer_ec18c19a7daa` | X→X |
| 黄泉渡りの霊僧 | 墓場の爆発 | 墓場の忘れ物 | `necromancer_grave_blast` | `src_necromancer_8648573c0b1b` | 1→1 |
| 黄泉渡りの霊僧 | 採取 | 彼岸の落とし物係 | `necromancer_harvest` | `src_necromancer_79860b0110cf` | 1→1 |
| 黄泉渡りの霊僧 | 刻限 | 黄泉時計の針 | `necromancer_deadline` | `src_necromancer_abdff984bbad` | 2→2 |
| 岩核の機巧師 | ビームセル | 岩核の照準光 | `machinist_beam_cell` | `src_machinist_1f8930dddb10` | 0→0 |
| 岩核の機巧師 | コンパイル・ドライバ | 石板の並列読込 | `machinist_compile` | `src_machinist_9bf57e55bb92` | 1→1 |
| 岩核の機巧師 | 起動シーケンス | 朝活起動手順 | `machinist_boot` | `src_machinist_8285a8de4ae4` | 0→0 |
| 岩核の機巧師 | 廃品回収 | 古代配線の回収 | `machinist_salvage` | `src_machinist_f9a361f29ec0` | 1→1 |
| 岩核の機巧師 | ハイパービーム | 岩核砲、全開 | `machinist_hyperbeam` | `src_machinist_61008ba27023` | 2→2 |
| 岩核の機巧師 | アイスランス | 凍土の岩槍 | `machinist_ice_lance` | `src_machinist_810c5911324b` | 3→3 |
| 岩核の機巧師 | 超臨界 | 祈りの臨界点 | `machinist_supercritical` | `src_machinist_b98f4cfb0667` | 0→0 |
| 岩核の機巧師 | クアッドキャスト | 四重の開放詠唱 | `machinist_quadcast` | `src_machinist_bb66560b4ae0` | 1→0 |
| 岩核の機巧師 | 集中砲火 | 岩核の斉射 | `machinist_barrage` | `src_machinist_ebd9d70b74a3` | 1→1 |
| 岩核の機巧師 | 寒気 | 冷える集会所 | `machinist_chill` | `src_machinist_aaee0d1f7bc5` | 0→0 |
| 岩核の機巧師 | ダブルエナジー | 岩電池の倍祈願 | `machinist_double_energy` | `src_machinist_58c6c1729a93` | 1→0 |
| 岩核の機巧師 | マルチキャスト | 岩核の連続解放 | `machinist_multicast` | `src_machinist_a3a830dbb856` | X→X |
| 岩核の機巧師 | 目潰し | 粉塵の照準妨害 | `machinist_eye_poke` | `src_machinist_706c7aa8a30e` | 0→0 |
| 岩核の機巧師 | FTL | 朝活に間に合う一撃 | `machinist_ftl` | `src_machinist_9314ad3555ea` | 0→0 |
| 岩核の機巧師 | 機械学習 | 岩核の経典学習 | `machinist_machine_learning` | `src_machinist_f496ca6aa8d0` | 1→1 |
| 岩核の機巧師 | ホログラム | 残像の石板 | `machinist_hologram` | `src_machinist_14fc77df195d` | 1→1 |
| 岩核の機巧師 | 同期 | 岩核の共通周波数 | `machinist_synchrony` | `src_machinist_0ba8b412c1a3` | 1→1 |
| 岩核の機巧師 | 粉砕 | 岩核の大解体 | `machinist_pulverize` | `src_machinist_d5916d6b3a78` | 1→1 |

## 未実装の資料一覧と理由

以下のカードは取得対象に登録しません。資料が明確でも、対応システムと通常・強化の検証が完了するまで取得可能にしません。「専用処理未実装」は今回の共通エンジン拡張だけでは元の効果をすべて満たせないカードを含みます。

### 岩砕の拳僧：48種類

| 資料名 | 資料ID | 未実装・確認理由 |
| --- | --- | --- |
| 溶岩の拳 | `src_berserker_5e8cbc75dd32` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| パーフェクトストライク | `src_berserker_bcf6c3788b6b` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 荒廃 | `src_berserker_acf624e92af8` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 武装 | `src_berserker_4fce919e28a7` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 悪意 | `src_berserker_02b4cbe2732f` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| グラップル | `src_berserker_49caca089e20` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| ぶんどる | `src_berserker_90df171ac858` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| ランページ | `src_berserker_57953443624b` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 冷酷 | `src_berserker_33f434c1ab63` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 踏みつけ | `src_berserker_71e8519591c1` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 彼方からの遠吠え | `src_berserker_a25464e92f7f` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| バトルトランス | `src_berserker_f217800f1661` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 悪魔の盾 | `src_berserker_2035eda3997d` | 他プレイヤーの対象・単独プレイ時の扱いが未確定 |
| イービルアイ | `src_berserker_71e42ba21e35` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| セカンドウィンド | `src_berserker_ee98efdf4f18` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 威圧 | `src_berserker_fbbf10865387` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 非道の刃 | `src_berserker_3362a5501c21` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 忘れられし儀式 | `src_berserker_9ea6f4d8de6e` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 戦いの予感 | `src_berserker_14e90f90efe3` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 戦いのドラム | `src_berserker_d789942797d1` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| インフェルノ | `src_berserker_9bf4d3c8adae` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| ジャグリング | `src_berserker_92cd8fd6e217` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 血の沸騰 | `src_berserker_539007937786` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 残忍 | `src_berserker_963843363467` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 無痛 | `src_berserker_7279d4065e9a` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 暴走 | `src_berserker_e5f06547e0fa` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 契約の終わり | `src_berserker_f0ab04da4d0b` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 捕食 | `src_berserker_73188e2a88d6` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 滅多打ち | `src_berserker_abbc47b1003e` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 猛火 | `src_berserker_31dd50d6756f` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 鬼火 | `src_berserker_53a8f4d19837` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 八つ裂き | `src_berserker_7e4574e66672` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| カスケード | `src_berserker_6cce2c7739d8` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 原始の力 | `src_berserker_7ce6cc034cb6` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| ワン・ツーパンチ | `src_berserker_4e10e6d0aac9` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 巨人 | `src_berserker_546c36f1a691` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 焚きつけ | `src_berserker_5498b49b4b62` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| タンク | `src_berserker_93e5de68cd9d` | 他プレイヤーの対象・単独プレイ時の扱いが未確定 |
| 残酷 | `src_berserker_83760560f080` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 深紅の衣 | `src_berserker_7aad9e854ed6` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 闘争心 | `src_berserker_e8b285993d19` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| ジャガーノート | `src_berserker_0421670922ea` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| ヘル・レイザー | `src_berserker_c0337e491948` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 闇の抱擁 | `src_berserker_82b6aea5dd39` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 盤石 | `src_berserker_803bd8e7e283` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| バリケード | `src_berserker_6f99356cb1ac` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 堕落 | `src_berserker_e6297bcf2c45` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 巨大な岩 | `src_berserker_cafae2c4d8c8` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |

### 静刃の影師：50種類

| 資料名 | 資料ID | 未実装・確認理由 |
| --- | --- | --- |
| フリック・フラック | `src_assassin_4b4a7a3084ba` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 跳弾 | `src_assassin_cdfa5d03ab4e` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 不可侵 | `src_assassin_b9ed744eb6b1` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| フィニッシャー | `src_assassin_90a99c6f89f7` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| フレシェット | `src_assassin_7ccf35f9a67d` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| メメント・モリ | `src_assassin_bde214c8f154` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 絞殺 | `src_assassin_303f3bfa8711` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 追打ち | `src_assassin_b85ee2401fc4` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 急襲 | `src_assassin_5ce5b999342e` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| ピンポイント | `src_assassin_cc294199b8ab` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 脱出計画 | `src_assassin_ed7f70728f44` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 暴露 | `src_assassin_7012d74bb768` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| ブラー | `src_assassin_083c8dc9e8be` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 手品 | `src_assassin_c90f7cb50ccb` | 対象・条件・リソースの意味を仕様確認する必要がある |
| バウンドフラスコ | `src_assassin_304bb5a8d4b0` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 奥の手 | `src_assassin_369a0ce8b4e1` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 挟撃 | `src_assassin_0f290f440858` | 他プレイヤーの対象・単独プレイ時の扱いが未確定 |
| 策士 | `src_assassin_4f85c3fe3161` | 獲得エナジー量が資料に未記載 |
| 毒の薄霧 | `src_assassin_06cc2293335d` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 反射神経 | `src_assassin_db20ae9cbf67` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| ファントムブレード | `src_assassin_a2ce75af7113` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 感染爆発 | `src_assassin_422cf611fe1f` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 用意周到 | `src_assassin_83291b164801` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| スピードスター | `src_assassin_4817775f2f9e` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| グランドフィナーレ | `src_assassin_74fbf1b68abf` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 狩猟 | `src_assassin_63d96b1dd0a9` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 反響する斬撃 | `src_assassin_93b3eb31b87d` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 殺害 | `src_assassin_d120f50a4bc9` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| アドレナリン | `src_assassin_6dc8f6201b1b` | 獲得エナジー量が資料に未記載 |
| 不快感 | `src_assassin_b2752c9f5d72` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| シャドウステップ | `src_assassin_4ab4570cedda` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| バースト | `src_assassin_5d376f8885cd` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 影との融合 | `src_assassin_d91834dde452` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 鋼の嵐 | `src_assassin_1cdb4aa8eed5` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 腐食の波 | `src_assassin_6f8809016e4c` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 墨の刃 | `src_assassin_bb360352ccc1` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| ナイフの罠 | `src_assassin_8f4e5b491609` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| パレットタイム | `src_assassin_c19d064fc2ee` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 悪夢 | `src_assassin_e4c2d34c0328` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 残像 | `src_assassin_0791db27838c` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 商売道具 | `src_assassin_a7112fefa5ba` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 促進剤 | `src_assassin_102bea355062` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| ナイフの雨 | `src_assassin_d18c822c5452` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 隠密 | `src_assassin_80eda9fe0eed` | 他プレイヤーの対象・単独プレイ時の扱いが未確定 |
| 稀代の策士 | `src_assassin_d3cff085168a` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 追跡 | `src_assassin_782d2fdf60c5` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 毒の仕込み | `src_assassin_50fde746bb85` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 刺々しい | `src_assassin_bcf69243b633` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 大蛇化 | `src_assassin_f2b9a7e1307a` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 死霊化 | `src_assassin_a99fbda2751f` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |

### 星詠みの法王：50種類

| 資料名 | 資料ID | 未実装・確認理由 |
| --- | --- | --- |
| 衝突軌道 | `src_oracle_fcded6e5ba4e` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 三日月の槍 | `src_oracle_1942c1c3a0d8` | 対象・条件・リソースの意味を仕様確認する必要がある |
| 失せよ！ | `src_oracle_b71406a291aa` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 月光波 | `src_oracle_52aa40501375` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 星くず | `src_oracle_4e194b0088da` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| シャイニングストライク | `src_oracle_2e5afc8636a2` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 王様パンチ | `src_oracle_24bbe47fa812` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 超巨大 | `src_oracle_eed47c7b705b` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| ノックアウト | `src_oracle_5241af724c6e` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 王様キック | `src_oracle_f6a0d1d8f296` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| クエーサー | `src_oracle_226e069de626` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| モノローグ | `src_oracle_143e706e67b1` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 寛大なる施し | `src_oracle_e272d8ad32dd` | 他プレイヤーの対象・単独プレイ時の扱いが未確定 |
| 粒子障壁 | `src_oracle_83ec6fdfbc91` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 集約 | `src_oracle_ed69652a8176` | 対象・条件・リソースの意味を仕様確認する必要がある |
| 征服者 | `src_oracle_4bf8e8f38453` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 突撃せよ！ | `src_oracle_c63e5fe9b5c7` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 反射 | `src_oracle_8a8f1a0cf7cf` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| パリィ | `src_oracle_e38ae6c48f76` | 通常または強化のコスト「ー」の意味が未確定 |
| ブラックホール | `src_oracle_8623ca7ac916` | 通常または強化のコスト「ー」の意味が未確定 |
| ペイル・ブルー・ドット | `src_oracle_9def9a3b526d` | 通常または強化のコスト「ー」の意味が未確定 |
| 星の子 | `src_oracle_16d9318f7aeb` | 通常または強化のコスト「ー」の意味が未確定 |
| 創造の柱 | `src_oracle_6220a2bc516b` | 通常または強化のコスト「ー」の意味が未確定 |
| 溶鉱炉 | `src_oracle_bcd53a6786dd` | 通常または強化のコスト「ー」の意味が未確定 |
| オービット | `src_oracle_3f0991e2d706` | 獲得エナジー量が資料に未記載 |
| スペクトラムシフト | `src_oracle_d5cfc8a88bad` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 実行せよ | `src_oracle_4050c3829b03` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 叩き直してやる | `src_oracle_f3fba35351b4` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 不時着 | `src_oracle_69fe3f35be76` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 家宝のハンマー | `src_oracle_1134cf4b7367` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 爆撃 | `src_oracle_6fa4c423eb4e` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| ビッグバン | `src_oracle_76e659b73854` | 獲得エナジー量が資料に未記載 |
| 悩ましい選択 | `src_oracle_2f14abbafc20` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 我に死角なし | `src_oracle_dc8721498c2d` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 確定事項 | `src_oracle_2b073b80e3b7` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 盾となれ！！ | `src_oracle_c5a7ca6cb8c1` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| ニュートロン・イージス | `src_oracle_ba73053110c8` | 通常または強化のコスト「ー」の意味が未確定 |
| ロイヤリティ | `src_oracle_8dac8d8849a2` | 通常または強化のコスト「ー」の意味が未確定 |
| 専制 | `src_oracle_5e6b0ef62944` | 通常または強化のコスト「ー」の意味が未確定 |
| 追尾の刃 | `src_oracle_b0ce210fefa6` | 通常または強化のコスト「ー」の意味が未確定 |
| 武器庫 | `src_oracle_21b0ea9632ba` | 通常または強化のコスト「ー」の意味が未確定 |
| ジェネシス | `src_oracle_6bd6c36e37d5` | 通常または強化のコスト「ー」の意味が未確定 |
| ハンマータイム | `src_oracle_5572e1ee2454` | 他プレイヤーの対象・単独プレイ時の扱いが未確定 |
| 剣聖 | `src_oracle_d9f0905fa188` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 虚無化 | `src_oracle_791bd7117405` | 通常または強化のコスト「ー」の意味が未確定 |
| 君主の睨み | `src_oracle_077cc1a187fb` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 封印されし玉座 | `src_oracle_a04d812c2dea` | 通常または強化のコスト「ー」の意味が未確定 |
| ミニオンストライク | `src_oracle_8aac73f28e33` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| ミニオンの特攻 | `src_oracle_9645dd5fb968` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| ミニオンの盾 | `src_oracle_cc307e043a5a` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |

### 黄泉渡りの霊僧：47種類

| 資料名 | 資料ID | 未実装・確認理由 |
| --- | --- | --- |
| パチン | `src_necromancer_159258ea3e5f` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 彫刻のストライク | `src_necromancer_549f8d81015c` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| ぺしゃんこ | `src_necromancer_536b4488cb08` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| とってこい | `src_necromancer_95daa576470d` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| まさに右腕 | `src_necromancer_6bfe313fccaa` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| ガラガラ | `src_necromancer_7fccd1bd5f57` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| ペールピアサー | `src_necromancer_30269bf476dd` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| やっちゃえ | `src_necromancer_253890f969a4` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 骨の破片 | `src_necromancer_390bb32ab033` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 死の行進 | `src_necromancer_1292f67bff57` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 衰弱 | `src_necromancer_4e6afdc8b871` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 地底からの引き寄せ | `src_necromancer_84f68f084125` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 借り物の時間 | `src_necromancer_9a8c44ea600f` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 葬送歌 | `src_necromancer_3ab6e3e630fd` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 激励 | `src_necromancer_a66fb32ca44b` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 死への扉 | `src_necromancer_82df11851314` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 憂鬱 | `src_necromancer_47ee09176b84` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| カウントダウン | `src_necromancer_b7ee2aa84262` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 影の衣 | `src_necromancer_b925ebcfb8b4` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 骨強化 | `src_necromancer_e3310f8da0ab` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 殺意 | `src_necromancer_e6e1b3783bf3` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 死の舞踏 | `src_necromancer_35ebdf945091` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 紙の嵐 | `src_necromancer_2e51ab8c258f` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 憑依 | `src_necromancer_2e84be427dbf` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 呪肉の奇術 | `src_necromancer_9874d8171a0a` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| ミザリー | `src_necromancer_10248a85ece5` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| ソウルストーム | `src_necromancer_0bf0d5b3fa81` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 絞首 | `src_necromancer_ee9b9dde4665` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 大鎌 | `src_necromancer_886a45e04202` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 絞り取り | `src_necromancer_27b9a3062bf6` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| バンシーの叫び | `src_necromancer_170512114c23` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| オブリビオン | `src_necromancer_d1218155579f` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 降霊術 | `src_necromancer_ff995cd4fb96` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 生贄 | `src_necromancer_ac93f73c8e9c` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 変貌 | `src_necromancer_e5f5a30454a0` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 亡霊の儀 | `src_necromancer_773559b15f85` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 終末の日 | `src_necromancer_9631c4afbb00` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| ニューロサージ | `src_necromancer_f40e9ca3e660` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 灰の精霊 | `src_necromancer_d9b502c87a98` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 虚空の叫び声 | `src_necromancer_a1173a45ccc7` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 魂喰らい | `src_necromancer_e63323d4a8ed` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| ネクロマスタリー | `src_necromancer_497c5d79b161` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 監視モード | `src_necromancer_0245f0764b5b` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 死神化 | `src_necromancer_e0803a3846fe` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| プロテクター | `src_necromancer_acb4e5e0a279` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 禁断の魔導書 | `src_necromancer_0e9c97bc275e` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 索敵の眼差し | `src_necromancer_8b1d20793041` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |

### 岩核の機巧師：49種類

| 資料名 | 資料ID | 未実装・確認理由 |
| --- | --- | --- |
| ヘドロ投げ | `src_machinist_ad384ef87645` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| モメンタムストライク | `src_machinist_af6a30aa4da7` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 大騒ぎ | `src_machinist_81e4f1633e41` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 加速！ | `src_machinist_7db2feee87c3` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 緊急回避 | `src_machinist_843e7bc46efd` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| スクレイブ | `src_machinist_d35d27121fcd` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| シンセシス | `src_machinist_f99e7da983d0` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| ヌル | `src_machinist_e91dd6c40615` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| ロケットパンチ | `src_machinist_c0cb3afbb694` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 屈折 | `src_machinist_d3544ffe2913` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 切断 | `src_machinist_624fadf855c8` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| オーバークロック | `src_machinist_cb321566bcc4` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| エナジーサージ | `src_machinist_c739dd791b4f` | 取得するリソース名が資料に未記載 |
| ガラス細工 | `src_machinist_19ce3ec53f7f` | 対象・条件・リソースの意味を仕様確認する必要がある |
| ホワイトノイズ | `src_machinist_a7091aac0bf6` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 圧縮 | `src_machinist_91b7b6dd76ba` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 暗黒 | `src_machinist_46563bbb9cc1` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 強行突破 | `src_machinist_a14937b27667` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 混沌 | `src_machinist_8bd521e57fe5` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| シャドウシールド | `src_machinist_cbb0ed13babf` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 融合 | `src_machinist_b9419eb861de` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| サブルーティン | `src_machinist_f68eec42518b` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| サンダー | `src_machinist_dc5215029b11` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| ストーム | `src_machinist_8fbd5cef663c` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| ヘイルストーム | `src_machinist_54fc38f78405` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| ループ | `src_machinist_ff39e6ff1ad2` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 煙突 | `src_machinist_010121b57f4c` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 反復 | `src_machinist_9f3665d984ed` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 肉体改造 | `src_machinist_15845ba3da22` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 野生 | `src_machinist_068817a7433e` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 螺旋ドリル | `src_machinist_3371df9f0ec5` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| アダプティストライク | `src_machinist_e6cbe613676f` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| オール・フォー・ワン | `src_machinist_ffa196490a71` | 対象・条件・リソースの意味を仕様確認する必要がある |
| 対空砲 | `src_machinist_e5acc182e4cc` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| メテオストライク | `src_machinist_8d3290751bca` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 改造 | `src_machinist_04d8b58553e0` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 再起動 | `src_machinist_6167ee0760bc` | 対象・条件・リソースの意味を仕様確認する必要がある |
| イグニッション | `src_machinist_7d54c1f9743b` | 他プレイヤーの対象・単独プレイ時の扱いが未確定 |
| 遺伝的アルゴリズム | `src_machinist_ed292dd643c7` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 信号増幅 | `src_machinist_5224a4f7cc67` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| レインボー | `src_machinist_d17fd0d2aeaf` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 電圧上昇 | `src_machinist_c622dbb63129` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| スピナー | `src_machinist_cdbb7552d3eb` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 災い転じて | `src_machinist_14a4650e569c` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| バッファー | `src_machinist_61224cd727f8` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 貪る影 | `src_machinist_9afda7060911` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| クリエイティブAI | `src_machinist_8cd66c6e5327` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 反響化 | `src_machinist_ef284ad0b1ab` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 燃料 | `src_machinist_fa273d2fa663` | 獲得エナジー量が資料に未記載 |

### 無色・共通：90種類

| 資料名 | 資料ID | 未実装・確認理由 |
| --- | --- | --- |
| 四方斬り | `src_colorless_32f0eb951f82` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| シーカーストライク | `src_colorless_ac113f570202` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 共鳴の手斧 | `src_colorless_1b631206d33c` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 拳闘 | `src_colorless_61dd4a9d70a3` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 総攻撃 | `src_colorless_4690d4658ca9` | 他プレイヤーの対象・単独プレイ時の扱いが未確定 |
| タッグチーム | `src_colorless_e98e6bb41127` | 他プレイヤーの対象・単独プレイ時の扱いが未確定 |
| お前を信じる | `src_colorless_f37b2402ad0a` | 他プレイヤーの対象・単独プレイ時の扱いが未確定 |
| 延長 | `src_colorless_bc3fde801e1b` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 何でも屋 | `src_colorless_d6a88efa5d12` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 苛立ち | `src_colorless_43bda7abd06f` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 焦燥 | `src_colorless_c1831cb1fa3e` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 非常ボタン | `src_colorless_b513acc33c11` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 祓い清め | `src_colorless_67370a2d862f` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| インターセプト | `src_colorless_4f558f781b83` | 他プレイヤーの対象・単独プレイ時の扱いが未確定 |
| スプラッシュ | `src_colorless_5b7446a3dff2` | 他プレイヤーの対象・単独プレイ時の扱いが未確定 |
| 作戦会議 | `src_colorless_dc691b5a09e6` | 他プレイヤーの対象・単独プレイ時の扱いが未確定 |
| 持ち上げ | `src_colorless_809fab93ad00` | 他プレイヤーの対象・単独プレイ時の扱いが未確定 |
| 発見 | `src_colorless_eff44e759df9` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 連携 | `src_colorless_e73b7be6f0d5` | 他プレイヤーの対象・単独プレイ時の扱いが未確定 |
| 均衡 | `src_colorless_2588b5b9bacc` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 天変地異 | `src_colorless_6e70e18bca06` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 爆弾 | `src_colorless_74d638667b96` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 威風堂々 | `src_colorless_3922a97d6431` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| ウォームアップ | `src_colorless_a045e742667d` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| オートメーション | `src_colorless_d54340a79b6b` | 獲得エナジー量が資料に未記載 |
| 計略 | `src_colorless_cc815cbd7b05` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 締め直し | `src_colorless_457847bb935c` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| ボーラ | `src_colorless_3c631aa2107a` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 一斉射撃 | `src_colorless_25cd7ac8cf34` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 金の斧 | `src_colorless_9f07d58bc244` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 強欲の手 | `src_colorless_0b516f85fb93` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| ジャックポット | `src_colorless_6f6108de08d9` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| ノックダウン | `src_colorless_d9fc32151c27` | 他プレイヤーの対象・単独プレイ時の扱いが未確定 |
| シークレットウェポン | `src_colorless_abb31b8bbc87` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| シークレットテクニック | `src_colorless_ed07504c7b79` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 背水の陣 | `src_colorless_8640dfd032d0` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| ものまね | `src_colorless_49bbd940f418` | 他プレイヤーの対象・単独プレイ時の扱いが未確定 |
| 隠された宝石 | `src_colorless_000e3851093d` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 聖なる選別 | `src_colorless_4215d3d1f3e0` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 錬金術 | `src_colorless_6279969b28fe` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 結集 | `src_colorless_57b84cf3f389` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| ビートダウン | `src_colorless_c818765b0c1a` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| エントロピー | `src_colorless_aba993289a48` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 希望の道標 | `src_colorless_1d4ced685a83` | 他プレイヤーの対象・単独プレイ時の扱いが未確定 |
| 郷愁 | `src_colorless_9115749f50d2` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 騒乱 | `src_colorless_ed7fd6d2d98b` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| カラミティ | `src_colorless_12426c501c56` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 大岩転がし | `src_colorless_a63374c46ed6` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| すす | `src_colorless_0f8e3080d39d` | 通常または強化のコスト「ー」の意味が未確定。通常または強化効果が欠落・「ー」 |
| めまい | `src_colorless_41fdcdf25b7c` | 通常または強化のコスト「ー」の意味が未確定。通常または強化効果が欠落・「ー」 |
| 火傷 | `src_colorless_71947070ef80` | 通常または強化のコスト「ー」の意味が未確定。通常または強化効果が欠落・「ー」 |
| 感染 | `src_colorless_a7b3fd750798` | 通常または強化のコスト「ー」の意味が未確定。通常または強化効果が欠落・「ー」 |
| 虚脱 | `src_colorless_9734aee9a775` | 通常または強化のコスト「ー」の意味が未確定。通常または強化効果が欠落・「ー」 |
| 虚無 | `src_colorless_d5cee6106624` | 通常または強化のコスト「ー」の意味が未確定。通常または強化効果が欠落・「ー」 |
| 精神腐敗 | `src_colorless_66db3891519c` | 通常または強化のコスト「ー」の意味が未確定。通常または強化効果が欠落・「ー」 |
| 怠惰 | `src_colorless_d2a0602ee21b` | 通常または強化のコスト「ー」の意味が未確定。通常または強化効果が欠落・「ー」 |
| 負傷 | `src_colorless_df898bf3ff4d` | 通常または強化のコスト「ー」の意味が未確定。通常または強化効果が欠落・「ー」 |
| 崩壊 | `src_colorless_b113030356e2` | 通常または強化のコスト「ー」の意味が未確定。通常または強化効果が欠落・「ー」 |
| デブリ | `src_colorless_cd1eeef8b6a2` | 通常または強化のコスト「ー」の意味が未確定。通常または強化効果が欠落・「ー」 |
| 決死の逃亡 | `src_colorless_23e3d3b01da8` | 通常または強化のコスト「ー」の意味が未確定。通常または強化効果が欠落・「ー」。対象・条件・リソースの意味を仕様確認する必要がある |
| 手招き | `src_colorless_132c7f69a964` | 通常または強化のコスト「ー」の意味が未確定。通常または強化効果が欠落・「ー」 |
| 毒素 | `src_colorless_6e18ce734c91` | 通常または強化のコスト「ー」の意味が未確定。通常または強化効果が欠落・「ー」 |
| 粘液 | `src_colorless_e1e0d1d51104` | 通常または強化のコスト「ー」の意味が未確定。通常または強化効果が欠落・「ー」 |
| アセンダーの厄災 | `src_colorless_fd4335752492` | 通常または強化のコスト「ー」の意味が未確定。通常または強化効果が欠落・「ー」 |
| 怪我 | `src_colorless_faf804ce3f79` | 通常または強化のコスト「ー」の意味が未確定。通常または強化効果が欠落・「ー」 |
| 疑念 | `src_colorless_77cc0ee18cff` | 通常または強化のコスト「ー」の意味が未確定。通常または強化効果が欠落・「ー」 |
| 強欲 | `src_colorless_076ea684c378` | 通常または強化のコスト「ー」の意味が未確定。通常または強化効果が欠落・「ー」 |
| 苦悩 | `src_colorless_6168ef42663a` | 通常または強化のコスト「ー」の意味が未確定。通常または強化効果が欠落・「ー」 |
| 愚行 | `src_colorless_ae84e964ac19` | 通常または強化のコスト「ー」の意味が未確定。通常または強化効果が欠落・「ー」 |
| 後悔 | `src_colorless_41e51eefe40c` | 通常または強化のコスト「ー」の意味が未確定。通常または強化効果が欠落・「ー」 |
| 罪悪感 | `src_colorless_c72bd580709d` | 通常または強化のコスト「ー」の意味が未確定。通常または強化効果が欠落・「ー」 |
| 鐘の呪い | `src_colorless_904ef97d6d6c` | 通常または強化のコスト「ー」の意味が未確定。通常または強化効果が欠落・「ー」 |
| 寝不足 | `src_colorless_09257b8295f4` | 通常または強化のコスト「ー」の意味が未確定。通常または強化効果が欠落・「ー」 |
| 不運 | `src_colorless_0adce1d2b975` | 通常または強化のコスト「ー」の意味が未確定。通常または強化効果が欠落・「ー」 |
| 不器用 | `src_colorless_132acb74d485` | 通常または強化のコスト「ー」の意味が未確定。通常または強化効果が欠落・「ー」 |
| 腐敗 | `src_colorless_92d5db02b6db` | 通常または強化のコスト「ー」の意味が未確定。通常または強化効果が欠落・「ー」 |
| 負債 | `src_colorless_4af22cb33c93` | 通常または強化のコスト「ー」の意味が未確定。通常または強化効果が欠落・「ー」 |
| 凡庸 | `src_colorless_62c8161ede60` | 通常または強化のコスト「ー」の意味が未確定。通常または強化効果が欠落・「ー」 |
| 羞恥 | `src_colorless_df46b09427ca` | 通常または強化のコスト「ー」の意味が未確定。通常または強化効果が欠落・「ー」 |
| 菌糸の汚染 | `src_colorless_c9105be5e0d7` | 通常または強化効果が欠落・「ー」 |
| 心酔 | `src_colorless_d79162b22a97` | 通常または強化効果が欠落・「ー」 |
| クラッシュ | `src_colorless_799ca688f580` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 啓発 | `src_colorless_87e5d6b71924` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 動揺 | `src_colorless_833edfae3e52` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| 二刀流 | `src_colorless_6d535202d32d` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| メタモルフォーゼ | `src_colorless_0a18428a61c8` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| ハロー・ワールド | `src_colorless_20659a0efb74` | 固有効果・条件・選択・持続処理の実装と通常／強化の検証が未完了 |
| ビャードニスの卵 | `src_colorless_60dbd18a11b0` | 通常または強化のコスト「ー」の意味が未確定。通常または強化効果が欠落・「ー」。対象・条件・リソースの意味を仕様確認する必要がある |
| ランタンの鍵 | `src_colorless_85b064e875e9` | 通常または強化のコスト「ー」の意味が未確定。通常または強化効果が欠落・「ー」。対象・条件・リソースの意味を仕様確認する必要がある |
| 戦利品の地図 | `src_colorless_34ed991bacea` | 通常または強化のコスト「ー」の意味が未確定。通常または強化効果が欠落・「ー」。対象・条件・リソースの意味を仕様確認する必要がある |

詳細な欠落箇所の行番号・原文・入力ファイルのハッシュは [取り込み監査](card-catalog-audit.md) と元JSONを参照してください。元資料にない数値、他プレイヤーから自分への対象変更、星消費、強化後の同一効果などを仮定して未実装カードを埋めません。
