# Uzbek Studio — Product Flows

*Last updated: 2026-09-25*

## Create a new look

1. Open the studio and start a new look.
2. Choose a garment family and an available authored garment; the mannequin loads it with its built-in attachments.
3. Orbit or reset the camera to inspect the garment.
4. Select one of the garment's declared parts.
5. Choose a textile; it applies to that part immediately.
6. Rotate or offset the texture until the pattern sits as intended.
7. Repeat for other parts, using undo or redo as needed.
8. Name and save the look.
9. Export a preview image or portable JSON when needed.

## Reopen and continue

1. Open Saved Looks from the left menu.
2. Select a named look.
3. The studio restores the compatible garment and asset versions, part materials, and texture placement.
4. Continue editing, save the updated look, or save a variant under a distinct name.

## Switch garments

1. Open garment selection and choose another authored garment.
2. If the current look contains unsaved changes, preserve them through a clear save, discard, or cancel choice.
3. Replace the garment and load its own parts and built-in attachments.
4. Present only controls supported by the newly selected garment.

## Recover from unavailable assets

1. When a saved look references a missing or incompatible asset version, keep the saved record intact.
2. Identify the unavailable garment or material in plain language.
3. Offer only safe recovery choices: retry, select a compatible replacement, or return to saved looks.
4. Never silently substitute a textile or garment and present it as the original design.

## Interaction separation

| Intent | Target | Result |
|---|---|---|
| Inspect | Empty canvas or camera control | Orbit or zoom the camera. |
| Edit surface | Garment part | Select that authored part. |
| Apply textile | Material choice | Assign it to the selected part. |
| Position pattern | Texture controls | Change rotation or U/V offset for that part. |
| Continue later | Saved look | Restore the editable composition. |

The first product flow excludes ordering, pricing, measurement, construction, and freeform attachment placement.
