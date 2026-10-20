import type { GuidedTourStep } from "./GuidedTour.vue";

/** Builds a contextual tour without making changes to the user's design. */
export function studioGuideSteps(
  patterned: boolean,
  grouped: boolean,
): readonly GuidedTourStep[] {
  return [
    {
      id: "new",
      target: '[data-tour="new-design"]',
      title: "Start a new design",
      body: "New design starts a fresh Nimcha. Your edited draft is kept in My looks.",
      placement: "bottom",
    },
    {
      id: "name",
      target: '[data-tour="look-name"]',
      title: "Name the design",
      body: "Click the centered name to edit it. Each rename is one undo step, and changes enter the recovery draft.",
      completeOn: "target-click",
      taskHint: "Click the design name to try the editor.",
      placement: "bottom",
    },
    {
      id: "garments",
      target: '[data-tour="garments-tab"]',
      title: "Choose a garment",
      body: "This tab opens the five garment shapes. Choosing a different shape resets its parts and materials; Undo brings the previous design back. Buttons, bindings and ties belong to their garment.",
      panel: "library",
      tab: "garments",
      completeOn: "target-click",
      taskHint: "Click Garments to open the library.",
      placement: "bottom",
    },
    {
      id: "parts",
      target: '[data-tour="part-picker"]',
      title: "Edit one part or several",
      body: "Open the part picker. Check several parts to edit them together, or click a part on the model. Shift-click adds or removes a part. Amber edges show the selection.",
      panel: "canvas",
      completeOn: "target-click",
      taskHint: "Open the part picker.",
      placement: "bottom",
    },
    {
      id: "materials",
      target: '[data-tour="change-material"]',
      title: "Choose a textile",
      body: "Change opens materials compatible with the selected parts. Clicking a swatch applies it to the selection. A group only shows materials every selected part can use.",
      panel: "inspector",
      completeOn: "target-click",
      taskHint: "Click Change to see compatible materials.",
      placement: "bottom",
    },
    ...(patterned
      ? [
          {
            id: "scale",
            target: '[data-tour="scale"]',
            title: "Set the pattern's size",
            body: "Edit material opens Material Studio. Save its shared scale to update every use, including saved looks. Movement and rotation stay on each garment part.",
            panel: "inspector",
            placement: "top",
          } satisfies GuidedTourStep,
        ]
      : []),
    ...(patterned && !grouped
      ? [
          {
            id: "anchors",
            target: '[data-tour="anchors"]',
            title: "Connect textile and garment",
            body: "The textile orb marks the pattern point. On garment lets you place that point on the silhouette. Reset restores centered placement and keeps the material's shared scale.",
            panel: "inspector",
            placement: "top",
          } satisfies GuidedTourStep,
        ]
      : []),
    {
      id: "camera",
      target: '[data-tour="camera"]',
      title: "Look around the piece",
      body: "Front, Back and Side animate the view. Drag or use two-finger scrolling to orbit; pinch or the plus/minus buttons to zoom. Camera movement never changes your textile placement.",
      panel: "canvas",
      completeOn: "target-click",
      taskHint: "Try a view or zoom button.",
      placement: "top",
    },
    {
      id: "save",
      target: '[data-tour="save-look"]',
      title: "Keep your look",
      body: "Save adds this design to My looks. The icon reports saving, saved or offline status. The current draft also has browser recovery and server storage.",
      panel: "canvas",
      placement: "bottom",
    },
    {
      id: "export",
      target: '[data-tour="export-look"]',
      title: "Take the idea with you",
      body: "Export downloads a clean image or editable design file. Import the design later to keep creating. Reopen this guide from Studio settings in the account menu whenever you need it.",
      panel: "canvas",
      placement: "bottom",
    },
  ];
}
