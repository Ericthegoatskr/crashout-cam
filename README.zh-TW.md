# Crashout Cam

**[開啟 Crashout Cam](https://crashout-cam.boundlessforge.chatgpt.site)** — 點 **Start camera** 並允許鏡頭即可玩。

[English documentation](README.md)

介面預設為英文，右上角「繁中 / EN」可切換並記住選擇。

**原始碼：** [Ericthegoatskr/crashout-cam](https://github.com/Ericthegoatskr/crashout-cam)。瀏覽器版可部署為靜態網站；Python 版在本機執行。

用 webcam 表情和手勢即時切換五張紅鳥迷因。**使用原圖，圖片上沒有字幕、框線或辨識關鍵點。**

瀏覽器版和 Python 版都已實作。兩版共用 `dist/assets/`、模型和 `dist/config.json`，各自使用 MediaPipe Tasks 執行臉部及雙手辨識。

## 瀏覽器版

在這個資料夾執行（不需要 npm install）：

```sh
python3 -m http.server 4173 --bind 127.0.0.1 --directory dist
```

開啟 <http://localhost:4173>，按「開啟鏡頭」並允許存取。也可以直接點五張縮圖預覽，不需要鏡頭。

- `Space`：開啟／停止鏡頭。
- `1`–`5`：鏡頭停止時預覽圖片。
- `F`：鏡頭和迷因區域全螢幕；`Esc` 離開。
- 「辨識設定」可調整微笑、張嘴靈敏度和切換等待，設定會保存在此瀏覽器。
- 切換到其他分頁或離開網站會停止鏡頭；回來後重新按開啟。
- 建議使用新版 Chrome、Edge 或 Safari。手機的全螢幕支援依瀏覽器而異。
- 分享部署需 HTTPS；`file://` 和一般區網 HTTP 網址不支援鏡頭權限。

所有模型、WebAssembly 和圖片都由這個網站直接提供；影像只在本機記憶體處理，不上傳、不錄影，也不使用麥克風。推論在 Web Worker 中執行，預設最高 30 FPS；實際速度依裝置而異。

## Python 本機版

建議 Python 3.11。這份專案已建立 `.venv`，目前這台電腦可以直接執行：

```sh
.venv/bin/python python/app.py
```

其他電腦首次安裝：

```sh
python3.11 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python scripts/download_models.py
python python/app.py
```

Windows 啟用虛擬環境用 `.venv\Scripts\activate`。macOS 若無法開啟鏡頭，請在「系統設定 → 隱私權與安全性 → 相機」允許啟動程式的終端機，再重開程式。

```sh
# 沒有鏡頭也能預覽五張圖
.venv/bin/python python/app.py --preview

# 切換另一個攝影機
.venv/bin/python python/app.py --camera 1

# 驗證模型與推論，不開啟攝影機或視窗
.venv/bin/python python/app.py --check
```

`Q` / `Esc` 關閉，`F` 切換全螢幕，`R` 重設。預覽模式用 `1`–`5` 選圖。一般模式左邊鏡頭、右邊迷因，無字幕。

## 動作對應

| 動作 | 圖片 |
| --- | --- |
| 放鬆、無特殊動作 | 普通鳥 |
| 一隻手靠近任一側耳朵 | 大耳鳥 |
| 兩隻手分別靠近頭部兩側 | 崩潰鳥 |
| 嘴巴張大 | 震驚鳥 |
| 微笑 | 快樂鳥 |

優先順序：雙手抱頭 → 單手靠耳朵 → 張嘴 → 微笑 → 普通。預設「立即」模式在第一個辨識結果就切圖，不再額外等待；若想減少切換，可選 150／300／500ms。舊版靈敏度設定會保留，但舊等待時間會改成「立即」，表情使用不同的進入／退出門檻降低閃爍；臉消失 700ms 後回普通鳥。手勢使用手掌到臉部兩側的距離，並依臉部寬度正規化；不是精確的耳朵或接觸偵測。面向鏡頭、光線均勻且手掌朝向鏡頭時較可靠。把手完全藏在頭後面可能偵測不到。這是幾何規則的迷因玩具，不推斷真實情緒。

兩版的預設值放在 `dist/config.json`。瀏覽器滑桿設定只保存在瀏覽器；要同步 Python，修改共用設定檔。更換圖片時保留五個檔名即可，顯示會保留比例、不裁切原圖。

## 檢查

```sh
node --test tests/detection.test.mjs
.venv/bin/python -m unittest discover -s tests
.venv/bin/python python/app.py --check
python3 scripts/download_models.py
```

兩種語言使用同一份 29 組測試情境，涵蓋優先順序、不同臉部大小、鏡像座標、兩手同側、表情遲滯、短暫雜訊和失去人臉。

瀏覽器整合測試：暫時將 `tests/browser-smoke.html` 複製到 `dist/_qa.html`，啟動本機伺服器後開啟 `http://localhost:4173/_qa.html`。它在 iframe 中用合成影片代替實體鏡頭，測試真實 WASM 推論、重開、停止、拒絕權限及取消競態。不要將 `_qa.html` 打包發布。

## 原始碼與素材

- `dist/`：可直接部署的靜態網頁；不需後端。
- `python/`：本機 OpenCV 視窗及相同的辨識規則。
- `tests/`：共用案例及瀏覽器整合測試。
- `models-manifest.json`：官方模型下載網址與 SHA-256。
- 五張迷因圖由使用者提供；本專案不宣稱擁有原始角色或圖片的權利。
- MediaPipe Tasks Vision 1.2.2 為 Apache-2.0。模型來源為 Google MediaPipe 官方模型儲存庫，程式參考官方 [Face Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker/web_js) 及 [Hand Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker/python) 文件。
