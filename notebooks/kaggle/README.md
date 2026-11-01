# Kaggle notebooks: train the letter models

Two notebooks that run the repository's own `ml/` scripts on Kaggle (import with MediaPipe, leave-one-person-out evaluation,
calibration table, export, validation), so the model files have exactly the format the app loads.

| Notebook | Dataset | Writes | Status |
| --- | --- | --- | --- |
| `signscribe_arsl_letters.ipynb` | ArSL21L (Mendeley 8hrn3bvdvk, CC BY 4.0) | `letters-arsl-mlp.json`, `letters-arsl-knn.json` | the same pipeline already ran once on Youssef's machine |
| `signscribe_asl_letters.ipynb` | ASL Alphabet Gestures (Mendeley 48dg9vhmyk v2, CC BY 4.0) | `letters-mlp.json`, `letters-knn.json` | never trained before; the notebook first discovers the folder layout and the signer folder |

How to run: Kaggle -> File -> Import Notebook; Settings: Internet **On**, Accelerator **None**; attach the dataset zip you already have
as a **private** Kaggle dataset (+ Add Input), or let it try Mendeley's public API. The output zip has the models, the reports,
`MODEL_RESULTS.md` (the repo's file with this run appended by `ml/evaluate.py`) and `RUN_INFO.json`.

Rules (the same as the repo's): keep the notebook and its output **private** (the k-NN file holds real landmark samples; 7 people in
ArSL21L are under 18); never commit the k-NN file or the takes file; quote only numbers the scripts wrote, and say they are on dataset
pictures, not a webcam.

Checked: both notebooks ran top to bottom in a pipeline test (generated hands, `SIGNSCRIBE_PIPELINE_TEST=1`) and the exported files
passed `ml/validate_model.py`. Not checked: the Mendeley download and MediaPipe on the real pictures (no access from where they were
written). Not covered (no public data fits): the control signs, the `none` class, J/Z templates, the picture-card detector.
