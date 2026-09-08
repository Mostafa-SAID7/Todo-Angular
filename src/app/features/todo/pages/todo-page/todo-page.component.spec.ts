import { TestBed, ComponentFixture } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { ReactiveFormsModule } from '@angular/forms';
import { TodoPageComponent } from './todo-page.component';
import { TodoFacade } from '../../../../core/services/todo.facade';
import { Todo } from '../../../../core/models/todo.model';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

class TodoFacadeStub {
  private todosSubject = new Subject<Todo[]>();
  private loadingSubject = new Subject<boolean>();
  private countSubject = new Subject<{ total: number; active: number; completed: number }>();

  todos$ = this.todosSubject.asObservable();
  loading$ = this.loadingSubject.asObservable();
  todosCount$ = this.countSubject.asObservable();

  loadTodos = jasmine.createSpy('loadTodos');
  addTodo = jasmine.createSpy('addTodo');
  toggleTodo = jasmine.createSpy('toggleTodo');
  deleteTodo = jasmine.createSpy('deleteTodo');

  emitTodos(todos: Todo[]) { this.todosSubject.next(todos); }
  emitLoading(v: boolean) { this.loadingSubject.next(v); }
  emitCount(c: { total: number; active: number; completed: number }) { this.countSubject.next(c); }
}

const createTodo = (
  id: number,
  title: string,
  completed: boolean,
  priority: Todo['priority'] = 'Low'
): Todo => ({
  id,
  title,
  completed,
  priority,
  dueDate: '2023-01-01',
  categoryId: 1,
  userId: 1,
  createdAt: '2023-01-01',
  updatedAt: '2023-01-01'
});

describe('TodoPageComponent', () => {
  let component: TodoPageComponent;
  let fixture: ComponentFixture<TodoPageComponent>;
  let facade: TodoFacadeStub;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TodoPageComponent, ReactiveFormsModule, NoopAnimationsModule],
      providers: [{ provide: TodoFacade, useClass: TodoFacadeStub }],
    }).compileComponents();

    fixture = TestBed.createComponent(TodoPageComponent);
    component = fixture.componentInstance;
    facade = TestBed.inject(TodoFacade) as unknown as TodoFacadeStub;
  });

  it('should call loadTodos on init and subscribe to todos', () => {
    fixture.detectChanges();
    expect(facade.loadTodos).toHaveBeenCalled();

    const todos: Todo[] = [
      createTodo(1, 'a', false),
      createTodo(2, 'b', true),
    ];
    facade.emitTodos(todos);

    // Trigger change detection to update computed signals
    fixture.detectChanges();
    expect(component.filteredTodos().length).toBe(2);
  });

  it('should set filter and compute filteredTodos for active', () => {
    fixture.detectChanges();
    const todos: Todo[] = [
      { id: 1, title: 'a', completed: false, priority: 'Low', dueDate: '2023-01-01', categoryId: 1, userId: 1, createdAt: '2023-01-01', updatedAt: '2023-01-01' },
      { id: 2, title: 'b', completed: true, priority: 'Low', dueDate: '2023-01-01', categoryId: 1, userId: 1, createdAt: '2023-01-01', updatedAt: '2023-01-01' },
    ];
    facade.emitTodos(todos);
    component.setFilter('active');
    fixture.detectChanges();
    expect(component.filteredTodos()).toEqual([
      jasmine.objectContaining({ id: 1, title: 'a', completed: false })
    ]);
  });

  it('should set filter and compute filteredTodos for completed', () => {
    fixture.detectChanges();
    const todos: Todo[] = [
      {
        id: 1, title: 'a', completed: false,
        priority: 'Low',
        dueDate: '',
        categoryId: 0,
        userId: 0,
        createdAt: '',
        updatedAt: ''
      },
      {
        id: 2, title: 'b', completed: true,
        priority: 'Medium',
        dueDate: '',
        categoryId: 0,
        userId: 0,
        createdAt: '',
        updatedAt: ''
      },
    ];
    facade.emitTodos(todos);
    component.setFilter('completed');
    fixture.detectChanges();
    expect(component.filteredTodos()).toEqual([
      jasmine.objectContaining({ id: 2, title: 'b', completed: true })
    ]);
  });

  it('should addTodo when form valid and trimmed title not empty, then reset form', () => {
    fixture.detectChanges();
    component.todoForm.setValue({ title: '  New Task  ', priority: 'High', dueDate: '2026-09-10' });
    component.addTodo();
    expect(facade.addTodo).toHaveBeenCalledWith({
      title: 'New Task',
      priority: 'High',
      dueDate: '2026-09-10',
      projectId: 1
    });
    expect(component.todoForm.value.title).toBe('');
  });

  it('should not addTodo when form invalid or empty after trim', () => {
    fixture.detectChanges();
    component.todoForm.setValue({ title: '  ', priority: 'Medium', dueDate: '2026-09-10' });
    component.addTodo();
    expect(facade.addTodo).not.toHaveBeenCalled();
  });

  it('should toggleTodo based on current completed state', () => {
    fixture.detectChanges();
    const todos: Todo[] = [
      createTodo(1, 'a', false),
      createTodo(2, 'b', true),
    ];
    facade.emitTodos(todos);

    component.toggleTodo(1);
    expect(facade.toggleTodo).toHaveBeenCalledWith(1, true);

    component.toggleTodo(2);
    expect(facade.toggleTodo).toHaveBeenCalledWith(2, false);
  });

  it('should not call toggleTodo if id not found', () => {
    fixture.detectChanges();
    facade.emitTodos([]);
    component.toggleTodo(99);
    expect(facade.toggleTodo).not.toHaveBeenCalled();
  });

  it('should call deleteTodo', () => {
    fixture.detectChanges();
    component.deleteTodo(5);
    expect(facade.deleteTodo).toHaveBeenCalledWith(5);
  });
});
