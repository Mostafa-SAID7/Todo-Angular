// src/app/features/todo/store/todo.reducer.ts
import { createReducer, on } from '@ngrx/store';
import { TodoActions } from './todo.actions';
import { Todo } from '../../../core/models/todo.model';

export interface TodoState {
  todos: Todo[];
  loading: boolean;
  error: string | null;
}

export const initialState: TodoState = {
  todos: [],
  loading: false,
  error: null
};

export const todoReducer = createReducer(
  initialState,

  // Load Todos
  on(TodoActions.loadTodos, (state) => ({
    ...state,
    loading: true,
    error: null
  })),
  on(TodoActions.loadTodosSuccess, (state, { todos }) => ({
    ...state,
    todos,
    loading: false,
    error: null
  })),
  on(TodoActions.loadTodosFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error
  })),

  // Add Todo
  on(TodoActions.addTodo, (state) => ({
    ...state,
    loading: true
  })),
  on(TodoActions.addTodoSuccess, (state, { todo }) => ({
    ...state,
    todos: [...state.todos, todo],
    loading: false,
    error: null
  })),
  on(TodoActions.addTodoFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error
  })),

  // Update Todo
  on(TodoActions.updateTodo, (state) => ({
    ...state,
    loading: true
  })),
  on(TodoActions.updateTodoSuccess, (state, { todo }) => ({
    ...state,
    todos: state.todos.map(t => t.id === todo.id ? todo : t),
    loading: false,
    error: null
  })),
  on(TodoActions.updateTodoFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error
  })),

  // Delete Todo
  on(TodoActions.deleteTodo, (state) => ({
    ...state,
    loading: true
  })),
  on(TodoActions.deleteTodoSuccess, (state, { id }) => ({
    ...state,
    todos: state.todos.filter(t => t.id !== id),
    loading: false,
    error: null
  })),
  on(TodoActions.deleteTodoFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error
  })),

  // Toggle Todo
  on(TodoActions.toggleTodo, (state) => ({
    ...state,
    loading: true,
    error: null
  }))
);
