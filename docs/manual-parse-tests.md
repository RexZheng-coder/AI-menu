# Manual Parse Flow Tests

Run the static app:

```bash
npm run build
npm run start
```

Open `http://127.0.0.1:4173/`.

## Mock Success

1. Upload a `.jpg`, `.jpeg`, `.png`, or `.webp` file.
2. Confirm the button is enabled.
3. Click `Scan Menu`.
4. Confirm the phase text moves through uploading/parsing and the Lantern House menu renders.
5. Add a dish, generate an order summary, and confirm the cart still works.

## Mock Failure

1. Upload an image file with `fail` in the file name, such as `fail-menu.png`.
2. Click `Scan Menu`.
3. Confirm a friendly error appears.
4. Click `Retry` to retry with the same file, or `Clear` to start over.

## Real Mode Missing Backend

1. Open `http://127.0.0.1:4173/?parse=real`.
2. Upload a valid image.
3. Click `Scan Menu`.
4. Confirm the app reports that real parsing is not available because the backend route is not configured.

## Invalid File Type

1. Upload a non-image file such as `.txt`.
2. Confirm the app rejects it and keeps `Scan Menu` disabled.

## Too-Large Image

1. Upload an image larger than 10MB.
2. Confirm the app rejects it and shows the file-size message.

## Parse Timeout

1. Open `http://127.0.0.1:4173/?parseTimeoutMs=100`.
2. Upload an image file with `slow` in the file name, such as `slow-menu.png`.
3. Click `Scan Menu`.
4. Confirm the timeout error appears with `Retry` and `Clear`.

## Empty Parsed Menu

1. Upload an image file with `empty` in the file name, such as `empty-menu.png`.
2. Click `Scan Menu`.
3. Confirm the app shows the empty-menu error instead of rendering a blank menu.
