import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Project {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  pinned?: boolean;
}

interface ProjectState {
  projects: Project[];
  activeProjectId: string | null;
  createProject: (name?: string) => string;
  setActiveProject: (id: string | null) => void;
  renameProject: (id: string, name: string) => void;
  toggleProjectPinned: (id: string) => void;
  removeProject: (id: string) => void;
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set, get) => ({
      projects: [],
      activeProjectId: null,
      createProject: (name) => {
        const id = crypto.randomUUID();
        const now = Date.now();
        const projectNumber = get().projects.length + 1;
        const project: Project = {
          id,
          name: name?.trim() || `未命名项目 ${projectNumber}`,
          createdAt: now,
          updatedAt: now,
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
      toggleProjectPinned: (id) =>
        set((state) => ({
          projects: state.projects.map((project) =>
            project.id === id
              ? { ...project, pinned: !project.pinned, updatedAt: Date.now() }
              : project,
          ),
        })),
      removeProject: (id) =>
        set((state) => ({
          projects: state.projects.filter((project) => project.id !== id),
          activeProjectId: state.activeProjectId === id ? null : state.activeProjectId,
        })),
    }),
    { name: 'mboard-projects' },
  ),
);
