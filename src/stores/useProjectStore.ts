import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Edge, Node } from '@xyflow/react';
import type { ProjectBoards } from '../components/canvas/canvasModel';

interface CanvasSession {
  projectId: string;
  originalCanvas: ProjectCanvasSnapshot;
  originalBoards?: ProjectBoards;
}

export interface ProjectCanvasSnapshot {
  nodes: Node[];
  edges: Edge[];
}

export interface Project {
  id: string;
  name: string;
  emoji?: string;
  createdAt: number;
  updatedAt: number;
  pinned?: boolean;
  canvas?: ProjectCanvasSnapshot;
}

interface ProjectState {
  projects: Project[];
  activeProjectId: string | null;
  canvasSession: CanvasSession | null;
  beginCanvasSession: (projectId: string) => void;
  captureCanvasBoards: (projectId: string, boards: ProjectBoards) => void;
  endCanvasSession: () => void;
  createProject: (name?: string) => string;
  setActiveProject: (id: string | null) => void;
  renameProject: (id: string, name: string) => void;
  setProjectEmoji: (id: string, emoji: string) => void;
  toggleProjectPinned: (id: string) => void;
  saveProjectCanvas: (id: string, canvas: ProjectCanvasSnapshot) => void;
  removeProject: (id: string) => void;
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set, get) => ({
      projects: [],
      activeProjectId: null,
      canvasSession: null,
      beginCanvasSession: (projectId) => {
        const project = get().projects.find((item) => item.id === projectId);
        if (!project) return;
        set({ activeProjectId: projectId, canvasSession: {
          projectId,
          originalCanvas: structuredClone(project.canvas || { nodes: [], edges: [] }),
        } });
      },
      captureCanvasBoards: (projectId, boards) => set((state) => ({
        canvasSession: state.canvasSession?.projectId === projectId && !state.canvasSession.originalBoards
          ? { ...state.canvasSession, originalBoards: structuredClone(boards) }
          : state.canvasSession,
      })),
      endCanvasSession: () => set({ canvasSession: null }),
      createProject: (name) => {
        const id = crypto.randomUUID();
        const now = Date.now();
        const projectNumber = get().projects.length + 1;
        const project: Project = {
          id,
          name: name?.trim() || (projectNumber === 1 ? '未命名项目' : `未命名项目 ${projectNumber}`),
          emoji: '😀',
          createdAt: now,
          updatedAt: now,
          canvas: { nodes: [], edges: [] },
        };
        set((state) => ({
          projects: [project, ...state.projects],
          activeProjectId: id,
        }));
        return id;
      },
      setActiveProject: (id) => set({ activeProjectId: id }),
      renameProject: (id, name) =>
        set((state) => ({
          projects: state.projects.map((project) =>
            project.id === id
              ? { ...project, name: name.trim() || project.name, updatedAt: Date.now() }
              : project,
          ),
        })),
      setProjectEmoji: (id, emoji) =>
        set((state) => ({
          projects: state.projects.map((project) =>
            project.id === id
              ? { ...project, emoji, updatedAt: Date.now() }
              : project,
          ),
        })),
      toggleProjectPinned: (id) =>
        set((state) => ({
          projects: state.projects.map((project) =>
            project.id === id
              ? { ...project, pinned: !project.pinned, updatedAt: Date.now() }
              : project,
          ),
        })),
      saveProjectCanvas: (id, canvas) =>
        set((state) => ({
          projects: state.projects.map((project) =>
            project.id === id
              ? { ...project, canvas, updatedAt: Date.now() }
              : project,
          ),
        })),
      removeProject: (id) =>
        set((state) => ({
          projects: state.projects.filter((project) => project.id !== id),
          activeProjectId: state.activeProjectId === id ? null : state.activeProjectId,
          canvasSession: state.canvasSession?.projectId === id ? null : state.canvasSession,
        })),
    }),
    { name: 'design-work-projects' },
  ),
);
