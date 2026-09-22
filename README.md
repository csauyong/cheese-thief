# 奶酪大盜 Cheese Thief

一支手機就能玩的《奶酪大盜》線上版。4–8 人，十分鐘一局，不用網路。

An online version of the board game **Cheese Thief**, built to run on one phone
in the middle of the table. 4–8 players, about ten minutes, works offline.

**▶ [csauyong.github.io/cheese-thief](https://csauyong.github.io/cheese-thief/)**

> 非官方同好作品，與出版社 Jolly Thinkers 無關。所有文字與圖像均為原創。
>
> An unofficial fan implementation. Not affiliated with or endorsed by Jolly
> Thinkers, who publish the game. All wording and artwork here is original.

---

## 怎麼用 / How it works

手機放在桌子中央，**照座位順序**傳一圈。每個人按住螢幕看自己的身分與點數，
放手就蓋回去。夜晚階段也是一樣傳一圈，每個人看到自己那一夜的完整報告。

The phone goes round the table **in seat order**. Each player presses and holds
to read their own role and die, and it hides the moment they let go. The night
works the same way: one pass round the table, each player reading a finished
account of their own night.

座位順序是刻意的。如果照點數順序傳，大家就會知道誰先醒、誰後醒——配上「奶酪還在不在」，
大盜當場現形。所以大盜的共犯要在「身分揭曉」時就先指定，四人局也在那時先選點數。

That seat order matters. Passing the phone in *hour* order would tell everyone
who woke before whom, and combined with whether the cheese was still there, that
hands them the thief. So the thief picks their 共犯 during the role reveal, and
the four-player die choice happens there too — by the night, every report is
already settled.

## 規則 / The rules

完整規則在 App 裡（主畫面 → 遊戲規則），中英文都有。摘要：

Full rules live in the app itself, in both languages. In brief:

| 人數 | 骰子/人 | 身分牌 | 共犯上限 | 獨自醒來可偷看 | 大盜睜眼 |
| ---- | ------- | ------ | -------- | -------------- | -------- |
| 4    | 2       | 1 大盜 + 3 貪睡鼠 | — | ✗ | 兩個點數都醒（相同則一次）|
| 5    | 1       | 1 大盜 + 4 貪睡鼠 | 1 | ✓ | 一次 |
| 6    | 1       | 1 大盜 + 4 貪睡鼠 + 1 背鍋鼠 | 1 | ✓ | 一次 |
| 7    | 1       | 1 大盜 + 5 貪睡鼠 + 1 背鍋鼠 | 2 | ✓ | 一次 |
| 8    | 1       | 1 大盜 + 6 貪睡鼠 + 1 背鍋鼠 | 2 | ✓ | 一次 |

- **夜晚**：主持人從 1 點數到 6 點，輪到自己的點數就睜眼。貪睡鼠獨自醒來可以掀開一個骰盅；
  有別人同時醒著就什麼都不能做。奶酪大盜睜眼時把奶酪拿走，**不能看別人的骰子**。
  同時醒著的貪睡鼠會看到大盜，大盜從中指定共犯。
- **白天**：自由討論，**不可以掀開骰盅或翻開身分牌**，其他都能說，包括說謊。
- **勝負**：最高票的人翻牌。大盜在其中，貪睡鼠贏；不在其中，大盜和共犯贏。
  背鍋鼠在其中，背鍋鼠自己贏（分開計算）。

### 兩個判斷 / Two judgement calls

規則來源沒有把這兩點講死，程式裡各取一種讀法，都在 `src/engine/rules.ts` 一行就能改：

1. **背鍋鼠不會被拉成共犯。** 他一樣看得到大盜，但保留自己的勝利條件。
2. **平票**預設依中文規則書算大盜被抓到；設定裡可以切成英文版後來的修訂（平票大盜贏）。

### 沒被拉下水的目擊者 / The witness left out

人數多的時候，可能有兩三隻老鼠同時和大盜醒著，而共犯名額不夠。沒被指定的那一位
**仍然知道誰是大盜**，而且還是貪睡鼠——他得在沒有任何證據的情況下說服全桌。這是規則寫明的，
也是這遊戲最好玩的一種局面。

## 開發 / Development

```bash
npm install
npm run dev        # http://localhost:5173/cheese-thief/
npm test           # 規則引擎測試 / engine tests
npm run typecheck
npm run build
```

### 專案結構 / Layout

```
src/engine/    純函式規則引擎，不碰 UI。發牌、夜晚、投票、勝負都在這裡
src/i18n/      繁體中文（來源）與英文字典；缺 key 編譯就會擋下來
src/app/       畫面與元件
src/store/     計分板與設定，存在 localStorage
scripts/       重新產生 PWA 圖示（無外部相依）
```

規則引擎是純函式，用種子亂數，所以測試可以直接指定「三個人同時和大盜醒著」這種
牌局，而不是靠運氣碰到。測試裡也有一條**不洩漏**的檢查：任何人的夜晚報告都不會提到
沒有和他同時醒著、也不是他偷看對象的玩家。

The engine is pure and seeded, so tests can specify awkward deals outright
rather than fishing for them. One test is a **leak invariant**: no player's night
report ever names someone who was neither awake alongside them nor the target of
their peek.

## 規則來源 / Sources

- [冒險安迪 — 奶酪大盜規則介紹](https://andyventure.com/boardgame-cheese-thief/)
- [桌弄 Drawnow — 奶酪大盜規則介紹](https://www.drawnow.com.tw/fun/content/110)
- [高雄龐奇桌遊 — 新版繁體中文版開箱及規則介紹](https://punchboardgame.pixnet.net/blog/post/468012296)
- [PTT BoardGame — 奶酪大盜規則分享](https://pttgamer.com/BoardGame/1VewiGfa)
- [BoardGameGeek — Cheese Thief](https://boardgamegeek.com/boardgame/294175/cheese-thief)
- [BGG — updated 4-player winning condition from the publisher](https://boardgamegeek.com/thread/3168167/updated-winning-condition-for-4-player-game-varian)

## 授權 / Licence

程式碼採 MIT（見 `LICENSE`）。《奶酪大盜》這款遊戲本身及其名稱屬於 Jolly Thinkers。

The code is MIT licensed. The game *Cheese Thief* and its name belong to Jolly
Thinkers; this repository only implements the rules, which are not copyrightable,
in its own words and artwork.
