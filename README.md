# 奶酪大盜 Cheese Thief

《奶酪大盜》線上版。4–8 人，十分鐘一局。兩種玩法：**一支手機**傳著玩（完全不用網路），
或是**每人一支手機**連線玩，重現真正的閉眼夜晚。

An online version of the board game **Cheese Thief**, two ways: **one phone**
passed round the table, which needs no network at all, or **a phone each** over a
direct peer-to-peer connection, which runs the real eyes-closed night. 4–8
players, about ten minutes. Still just a static page — no server, no accounts.

**▶ [csauyong.github.io/cheese-thief](https://csauyong.github.io/cheese-thief/)**

> 非官方同好作品，與出版社 Jolly Thinkers 無關。所有文字與圖像均為原創。
>
> An unofficial fan implementation. Not affiliated with or endorsed by Jolly
> Thinkers, who publish the game. All wording and artwork here is original.

---

## 兩種玩法 / Two ways to play

### 一支手機 / One phone

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

### 每人一支手機 / A phone each

一個人按「開一個房間」，畫面上會出現一個四字房號和 QR code；其他人掃碼或輸入房號就進來了。
連線是瀏覽器對瀏覽器（WebRTC），沒有我們的伺服器。

這個模式跑的是**真正的夜晚**：主持畫面從 1 點數到 6 點，輪到你的點數，你的手機才會亮起來給你看
那一刻的資訊。大盜也是在偷奶酪的當下才指定共犯，不像一支手機的版本要先講好。

One person opens a room and gets a four-character code and a QR; everyone else
scans or types it in. The connection is browser-to-browser over WebRTC, through
the public PeerJS broker — there is no server of ours anywhere in it.

This mode runs the **real night**: the hours are called 1 through 6 and your
phone only lights up on yours. The thief picks their 共犯 in the moment of the
theft, rather than in advance.

兩件值得知道的事 / Two things worth knowing:

- 房主的分頁要一直開著。那一頁**就是**這局遊戲；關掉房間就沒了。
  The host's tab *is* the game. Close it and the room goes with it.
- 每個「小時」的長度都一樣，就算那個時間沒有人醒著。如果沒人醒的時間一閃而過，
  大家馬上就知道那個時間沒人——所以夜晚是照時鐘走的，不是照大家按完沒。
  Every hour lasts the same length even when nobody is awake for it. An hour that
  ended early would announce that nobody woke then, so the night runs on a clock.

斷線了重新進來就好：房號加上瀏覽器裡存的一組 token，會把你放回原來的座位、原來的身分。

If a phone drops, rejoining puts it back in the same seat with the same card.

#### 換一個 broker / Pointing at your own broker

預設用 PeerJS 的公用 broker。如果它掛了或被你的網路擋住，可以自己跑一個，build 的時候指定：

```bash
VITE_PEER_HOST=192.168.1.10 VITE_PEER_PORT=9000 VITE_PEER_PATH=/ npm run build
```

Broker 只負責讓兩個瀏覽器互相認識，遊戲資料不會經過它。

The broker only introduces browsers to each other; no game data passes through it.

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

連線模式的端對端測試需要一個本機 broker（`npx peer --port 9000`），然後用四、五個瀏覽器
分頁跑完整一局。房間邏輯本身在 `src/net/room.test.ts` 裡不需要任何網路就能測。

The room logic is tested with no network at all in `src/net/room.test.ts`; the
WebRTC path was driven end-to-end against a local broker with five real browsers.

### 專案結構 / Layout

```
src/engine/    純函式規則引擎，不碰 UI。兩種玩法共用同一套規則
src/net/       連線模式：房間（權威端）、協定、WebRTC 傳輸
src/i18n/      繁體中文（來源）與英文字典；缺 key 編譯就會擋下來
src/app/       畫面與元件；src/app/live/ 是連線模式的畫面
src/store/     計分板與設定，存在 localStorage
scripts/       重新產生 PWA 圖示（無外部相依）
```

引擎有兩種進行方式：`hotseat` 照座位輪流，`live` 大家同時動、夜晚照時鐘走。規則本身完全一樣。

The engine has two progressions — `hotseat` takes seats in turn, `live` lets
everyone act at once — over one identical set of rules.

規則引擎是純函式，用種子亂數，所以測試可以直接指定「三個人同時和大盜醒著」這種
牌局，而不是靠運氣碰到。測試裡有三條**不洩漏**的檢查：

The engine is pure and seeded, so tests can specify awkward deals outright rather
than fishing for them. Three tests are **leak invariants**:

1. 任何人的夜晚報告都不會提到沒有和他同時醒著、也不是他偷看對象的玩家。
   No night report names someone who was neither awake alongside the reader nor
   the target of their peek.
2. 連線模式送出去的資料裡，身分和骰子只會出現在收件人自己那一塊。
   Over the wire, roles and dice appear only in the recipient's own corner of the
   payload — the leak boundary is what gets sent, not what the UI remembers to hide.
3. 夜晚不會說出「還在等誰」，也不會把別人的「已完成」告訴你——那等於直接說誰醒著。
   The night never says who it is waiting on, nor shows anyone else's ready flag,
   because either would name who is awake.

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
