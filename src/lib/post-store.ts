import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Post, TagWithMode } from './types';

interface SearchState {
  tags: TagWithMode[];
  sortOrder: string;
  filterAI: boolean;
  totalCount: number | null;
  scrollPosition: number;
}

interface PostStore {
  posts: Post[];
  currentIndex: number;
  searchState: SearchState;
  setPosts: (posts: Post[]) => void;
  setCurrentIndex: (index: number) => void;
  addPosts: (newPosts: Post[]) => void;
  setSearchState: (state: Partial<SearchState>) => void;
  setScrollPosition: (position: number) => void;
  clearPosts: () => void;
}

export const usePostStore = create<PostStore>()(
  persist(
    (set, get) => ({
      posts: [],
      currentIndex: -1,
      searchState: {
        tags: [],
        sortOrder: "id:desc",
        filterAI: false,
        totalCount: null,
        scrollPosition: 0,
      },
      setPosts: (posts) => set({ posts }),
      setCurrentIndex: (index) => set({ currentIndex: index }),
      addPosts: (newPosts) => set((state) => ({ 
        posts: [...state.posts, ...newPosts] 
      })),
      setSearchState: (newState) => set((state) => ({
        searchState: { ...state.searchState, ...newState }
      })),
      setScrollPosition: (position) => set((state) => ({
        searchState: { ...state.searchState, scrollPosition: position }
      })),
      clearPosts: () => set({ posts: [], currentIndex: -1 }),
    }),
    {
      name: 'post-store',
      partialize: (state) => ({
        searchState: state.searchState,
        // Don't persist posts and currentIndex for performance
      }),
    }
  )
); 