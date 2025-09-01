# Configuration Guide

## Screenshot Settings

Edit `config.json` to customize screenshot behavior:

```json
{
  "screenshot": {
    "format": "png",        // Image format: "png", "jpg", or "jpeg"
    "quality": 90,          // JPEG quality (1-100), ignored for PNG
    "captureInterval": 30,  // Seconds between automatic captures
    "outputFolder": "./screenshots"  // Base folder for screenshots
  }
}
```

### Configuration Options

#### `format`
- **Type:** String
- **Options:** `"png"`, `"jpg"`, `"jpeg"`
- **Default:** `"png"`
- **Description:** The image format for screenshots. PNG provides lossless compression, while JPG/JPEG offers smaller file sizes with configurable quality.

#### `quality`
- **Type:** Number (1-100)
- **Default:** `90`
- **Description:** JPEG compression quality. Only applies when format is "jpg" or "jpeg". Higher values mean better quality but larger file sizes.
  - 100 = Maximum quality, larger files
  - 90 = High quality, good balance (recommended)
  - 70-80 = Good quality, smaller files
  - Below 70 = Noticeable compression artifacts

#### `captureInterval`
- **Type:** Number (seconds)
- **Default:** `30`
- **Description:** Time between automatic screenshot captures in seconds. Minimum value is 1 second.

#### `outputFolder`
- **Type:** String
- **Default:** `"./screenshots"`
- **Description:** Base folder where screenshots will be saved. Screenshots are organized in date-based subfolders (e.g., `./screenshots/2024-01-15/`).

### Examples

#### High-Quality PNG (Default)
```json
{
  "screenshot": {
    "format": "png",
    "quality": 90,
    "captureInterval": 30,
    "outputFolder": "./screenshots"
  }
}
```

#### Space-Saving JPEG
```json
{
  "screenshot": {
    "format": "jpg",
    "quality": 85,
    "captureInterval": 60,
    "outputFolder": "./captures"
  }
}
```

#### Frequent Captures
```json
{
  "screenshot": {
    "format": "jpg",
    "quality": 70,
    "captureInterval": 10,
    "outputFolder": "./screenshots"
  }
}
```

### Notes

- Changes to `config.json` require a server restart to take effect
- The output folder will be created automatically if it doesn't exist
- Each day's screenshots are stored in a separate subfolder (YYYY-MM-DD format)
- File names include timestamp: `YYYY-MM-DD_HH-mm-ss_combined.{png|jpg}`