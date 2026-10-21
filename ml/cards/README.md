# Picture card detector (Python side)

The browser runs a **YOLOv8-style ONNX detector** (`public/models/cards.onnx` + `cards.json`). The model is trained here, by the team, on photographs of the printed cards. Nothing in this folder trains a model by itself and no result exists yet. Full procedure and contract: `docs/CARDS.md`.

| Script | Does |
| ------ | ---- |
| `make_data_yaml.py` | checks a YOLO-format photo folder against the class list in `src/data/contexts.json`, counts images and boxes per class, writes `cards.yaml` for training |
| `export_onnx.py` | turns trained weights (`best.pt`) into `cards.onnx` + `cards.json` in the layout the app reads |
| `check_onnx.py` | opens an ONNX file and checks input size, output layout and class count against `cards.json` |
| `make_fixture.py` | writes the tiny **test-only** ONNX used by the browser tests (always answers "Doctor card"). Not a detector |

    pip install -r ml/requirements.txt          # plus, for training only:  pip install ultralytics
    python ml/cards/make_data_yaml.py --root cards-photos
    yolo detect train data=cards-photos/cards.yaml model=yolov8n.pt imgsz=640 epochs=<your choice>
    python ml/cards/export_onnx.py --weights runs/detect/train/weights/best.pt --dataset cards-photos --out public/models/cards.onnx
    python ml/cards/check_onnx.py public/models/cards.onnx

The class list and its ORDER come from `src/data/contexts.json`. If you add or rename a card, retrain: the app refuses a model whose classes differ.
