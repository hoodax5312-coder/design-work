I will help you implement the **Floating Interaction System** for the NeuralFlow Canvas. Since the project directory is currently empty (except for `design.json`), I will first initialize a modern React application and then build the specific components you requested.

Here is the implementation plan:

## 1. Project Initialization
*   **Tech Stack**: React + TypeScript + Vite.
*   **Styling**: Tailwind CSS (configured with the design tokens from `design.json`).
*   **Icons**: Lucide React (for the specified UI icons).
*   **Animation**: Framer Motion (for smooth hover/entry effects).

## 2. Core Infrastructure
*   **Tailwind Config**: Extend the default theme with your specific colors (e.g., `#2e2e2e`, `#050505`) and typography.
*   **Canvas Context**: specific state management to handle node selection, positioning, and interaction modes.

## 3. Component Implementation
### 3.1 Image Node (`ImageNode.tsx`)
*   A base component to represent the "Image Node".
*   Handles selection state and hover events.
*   **Interaction**: Supports Shift+Click for multi-selection.

### 3.2 On-Image Toolbar (`FloatingToolbar.tsx`)
*   **Positioning**: Absolute positioning relative to the selected/hovered node.
*   **Style**: Dark gray pill shape (`#2e2e2e`), semi-transparent.
*   **Actions**:
    *   `Inpaint` (Brush icon)
    *   `Remove BG` (Scissors/Eraser icon)
    *   `Enhance` (Sparkles/Up arrow icon)
    *   `Outpaint` (Expand icon)
    *   `Face Fix` (Face/Smile icon)
    *   `Variations` (Shuffle/Layers icon)

### 3.3 Generation Command Center (`GenerationConsole.tsx`)
*   **Structure**:
    *   **Thumbnails**: Preview of selected source nodes (Model + Product).
    *   **Prompt Input**: Text area for natural language input.
    *   **Control Bar**: Dropdowns for Model, Aspect Ratio, ControlNet, and Batch size.
    *   **Generate Action**: Prominent button to trigger the generation flow.
*   **Behavior**: Automatically appears when valid context (e.g., 2+ nodes) is selected.

## 4. Interaction Logic Integration
*   Implement the "Context Selection" logic:
    *   User holds `Shift` and clicks multiple nodes -> Updates selection state.
    *   `GenerationConsole` detects multi-selection -> Slides up/fades in.
*   Implement "Generate" stub:
    *   Clicking "Generate" simulates creating a new result node and connecting lines.

I will start by setting up the project structure. Shall I proceed?