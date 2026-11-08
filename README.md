# photo_tool

Find and clean up unwanted photos from your phone: duplicates, burst shots,
blurry pictures, screenshots, saved memes, old or huge files.

Your phone can't run the script itself, so the script runs on a computer:

- **Android:** connect the phone by USB. The tool copies the photos over and,
  once you've reviewed them, deletes the unwanted ones **from the phone**.
- **iPhone:** copy the photos to a folder first. On a Mac use Image Capture;
  on Windows use the Photos app's Import, or File Explorer → Apple iPhone → DCIM.
  The tool cleans that folder. Apple doesn't allow scripts to delete photos on the
  iPhone, so use the review page as a checklist and delete those on the phone
  (or in iCloud Photos).

Nothing is deleted straight away. `clean` is a dry run until you add `--apply`.
Even then, files are only moved into `_to_delete/` and `restore` puts them back.

## Setup

```
pip install -r requirements.txt
```

For Android, also install [platform-tools](https://developer.android.com/tools/releases/platform-tools)
(`adb`) and turn on **USB debugging** (Settings → About phone → tap *Build number* 7 times →
Developer options → USB debugging).

## Usage

```
# Android only: copy photos off the phone
python photo_tool.py android-pull ~/PhonePhotos

# See what would be cleaned up, with a thumbnail page to review
python photo_tool.py find ~/PhonePhotos --duplicates --similar --blurry --screenshots --report review.html

# Move them aside (undo with: restore ~/PhonePhotos)
python photo_tool.py clean ~/PhonePhotos --duplicates --similar --blurry --screenshots --apply

# Android only: delete those from the phone too
python photo_tool.py android-delete ~/PhonePhotos --apply

# When you're sure: delete the set-aside copies for good
python photo_tool.py empty-trash ~/PhonePhotos --apply
```

### Filters

Categories are combined with OR:

| flag | matches |
|---|---|
| `--duplicates` | exact copies (keeps the best one) |
| `--similar [N]` | near-identical shots, such as bursts (keeps the sharpest, highest-res one; N = strictness, default 6) |
| `--blurry [SCORE]` | sharpness below SCORE (default 60) |
| `--screenshots` | screenshots |
| `--no-camera` | images with no camera info: memes, downloads, saved images |
| `--tiny [MP]` | images under MP megapixels (default 0.3) |
| `--larger-than MB` | files over MB megabytes |

Limits are combined with AND: `--name GLOB`, `--path GLOB`,
`--before YYYY-MM-DD`, `--after YYYY-MM-DD`, `--videos`, `--images`.
With limits only, everything inside them matches. For example:

```
python photo_tool.py clean ~/PhonePhotos --path 'WhatsApp*/*' --before 2022-01-01 --apply
python photo_tool.py find  ~/PhonePhotos --videos --larger-than 500
```

The first run analyses every file. After that, results are cached in `.photo_index.json`,
so later runs are fast.
