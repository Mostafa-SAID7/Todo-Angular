import {
  Component,
  computed,
  DestroyRef,
  ElementRef,
  HostListener,
  inject,
  OnInit,
  signal,
  ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TodoFacade } from '../../../../core/services/todo.facade';
import { Todo } from '../../../../core/models/todo.model';
import { Project } from '../../../../core/models/project.model';
import { AppNotification } from '../../../../core/models/notification.model';
import { LanguageService } from '../../../../core/services/language.service';
import { ThemeService } from '../../../../core/services/theme.service';
import { ProjectService } from '../../../../core/services/project.service';
import { NotificationService } from '../../../../core/services/notification.service';

type TodoView = 'all' | 'active' | 'completed';
type WorkspaceDialog = 'notifications' | 'help' | 'settings' | 'profile' | 'workspace' | null;

@Component({
  selector: 'app-todo-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './todo-page.component.html'
})
export class TodoPageComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly facade = inject(TodoFacade);
  private readonly destroyRef = inject(DestroyRef);
  private readonly themeService = inject(ThemeService);
  private readonly languageService = inject(LanguageService);
  private readonly projectService = inject(ProjectService);
  private readonly notificationService = inject(NotificationService);

  todos$ = this.facade.todos$;
  loading$ = this.facade.loading$;
  error$ = this.facade.error$;
  private readonly todosState = signal<Todo[]>([]);
  todos = this.todosState.asReadonly();
  filter = signal<TodoView>('all');
  searchQuery = signal('');
  activeNav = signal('Overview');
  activeProject = signal('Enterprise Upgrade');
  activeProjectId = signal<number | null>(null);
  selectedDate = signal(this.dateKey(new Date()));
  showComposer = signal(false);
  isSidebarOpen = signal(false);
  dialog = signal<WorkspaceDialog>(null);
  showProjectComposer = signal(false);
  projectName = signal('');
  todoToDelete = signal<Todo | null>(null);
  editingTodo = signal<Todo | null>(null);
  editingTitle = signal('');
  notifications = signal<AppNotification[]>([]);
  projects = signal<(Project & { color: string })[]>([
    { id: 1, name: 'Enterprise Upgrade', color: '#8b80ff' },
    { id: 2, name: 'Design system', color: '#f3a66f' },
    { id: 3, name: 'Marketing site', color: '#70d6a5' }
  ]);
  projectLoading = signal(false);
  theme = this.themeService.theme;
  language = this.languageService.currentLanguage;

  @ViewChild('searchInput') private searchInput?: ElementRef<HTMLInputElement>;

  readonly primaryNav = [
    { label: 'Overview', icon: 'overview' },
    { label: 'My tasks', icon: 'tasks' },
    { label: 'Calendar', icon: 'calendar' },
    { label: 'Analytics', icon: 'analytics' }
  ];

  weekDays = computed(() => this.buildWeekDays());

  calendarDays = this.buildCalendarDays();

  readonly todoForm = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.minLength(3)]],
    priority: ['Medium' as Todo['priority'], Validators.required],
    dueDate: [this.dateKey(new Date()), Validators.required]
  });

  filteredTodos = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const selectedDate = this.selectedDate();
    return this.todos().filter(todo => {
      const matchesFilter =
        this.filter() === 'all' ||
        (this.filter() === 'active' && !todo.completed) ||
        (this.filter() === 'completed' && todo.completed);
      const matchesProject =
        this.activeProjectId() === null || todo.projectId === this.activeProjectId();
      const matchesDate =
        this.activeNav() !== 'Calendar' ||
        !selectedDate ||
        this.dateKey(new Date(todo.dueDate)) === selectedDate;
      const matchesSearch =
        !query ||
        todo.title.toLowerCase().includes(query) ||
        (todo.description || '').toLowerCase().includes(query);
      return matchesFilter && matchesProject && matchesDate && matchesSearch;
    });
  });

  emptyTasksTitle = computed(() => {
    if (this.searchQuery().trim()) return 'No matching tasks';
    if (this.activeNav() === 'Calendar') return 'No tasks on this day';
    if (this.filter() === 'active') return 'No tasks in progress';
    if (this.filter() === 'completed') return 'No completed tasks';
    if (this.activeProjectId() !== null) return 'No tasks in this project';
    return 'Nothing here yet';
  });

  emptyTasksMessage = computed(() => {
    if (this.searchQuery().trim()) return 'Try a different search term.';
    if (this.activeNav() === 'Calendar') return 'Choose another day or create a task for this date.';
    if (this.filter() === 'active') return 'You are all caught up. New work will appear here.';
    if (this.filter() === 'completed') return 'Completed tasks will appear here when you finish them.';
    if (this.activeProjectId() !== null) return 'Add a task to this project to start making progress.';
    return 'Add your first task to start making progress.';
  });

  activeCount = computed(() => this.todos().filter(todo => !todo.completed).length);
  completedCount = computed(() => this.todos().filter(todo => todo.completed).length);
  unreadNotifications = computed(() => this.notifications().filter(item => !item.read).length);
  completionLabel = computed(() => `${this.completedCount()} of ${this.todos().length} tasks complete`);
  selectedDateLabel = computed(() => {
    const date = new Date(`${this.selectedDate()}T12:00:00`);
    return Number.isNaN(date.valueOf())
      ? 'Selected day'
      : new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(date);
  });
  progress = computed(() => {
    const total = this.todos().length;
    return total ? Math.round((this.completedCount() / total) * 100) : 0;
  });
  nextDueLabel = computed(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDates = this.todos()
      .filter(todo => !todo.completed && (this.activeProjectId() === null || todo.projectId === this.activeProjectId()))
      .map(todo => new Date(todo.dueDate))
      .filter(date => !Number.isNaN(date.valueOf()))
      .sort((left, right) => left.valueOf() - right.valueOf());

    if (!dueDates.length) return 'No upcoming tasks';

    const daysUntilDue = Math.ceil((dueDates[0].setHours(0, 0, 0, 0) - today.valueOf()) / 86_400_000);
    if (daysUntilDue <= 0) return daysUntilDue === 0 ? 'Due today' : 'Overdue';
    return `Due in ${daysUntilDue} day${daysUntilDue === 1 ? '' : 's'}`;
  });

  todayLabel = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  }).format(new Date());
  monthName = new Intl.DateTimeFormat('en-US', { month: 'long' }).format(new Date());
  year = new Date().getFullYear();

  ngOnInit(): void {
    this.facade.loadTodos();
    this.todos$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(todos => {
        this.todosState.set(todos);
        this.calendarDays = this.buildCalendarDays();
      });
    this.projectService.getProjects()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: projects => this.projects.set(this.withProjectColors(projects)),
        error: error => console.error('Unable to load projects:', error)
      });
    this.notificationService.getNotifications()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: notifications => this.notifications.set(notifications),
        error: error => console.error('Unable to load notifications:', error)
      });
  }

  selectNav(label: string): void {
    this.activeNav.set(label);
    this.activeProjectId.set(null);
    if (label === 'Overview') this.setFilter('all');
    if (label === 'My tasks') this.setFilter('active');
    if (label === 'Calendar') {
      this.setFilter('all');
      this.selectedDate.set(this.dateKey(new Date()));
      this.calendarDays = this.buildCalendarDays();
    }
    this.isSidebarOpen.set(false);
  }

  selectProject(project: Project & { color: string }): void {
    this.activeProject.set(project.name);
    this.activeNav.set(project.name);
    this.activeProjectId.set(project.id);
    this.setFilter('all');
    this.isSidebarOpen.set(false);
  }

  openProjectComposer(event?: Event): void {
    event?.stopPropagation();
    this.showProjectComposer.set(true);
  }

  createProject(): void {
    const name = this.projectName().trim();
    if (name.length < 2 || this.projectLoading()) return;

    this.projectLoading.set(true);
    this.projectService.createProject(name)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: project => {
          const projectWithColor = {
            ...project,
            color: this.projectColor(this.projects().length)
          };
          this.projects.update(projects => [...projects, projectWithColor]);
          this.selectProject(projectWithColor);
          this.projectName.set('');
          this.showProjectComposer.set(false);
          this.projectLoading.set(false);
        },
        error: error => {
          console.error('Unable to create project:', error);
          this.projectLoading.set(false);
        }
      });
  }

  selectDay(date: string): void {
    this.selectedDate.set(date);
    this.activeNav.set('Calendar');
    this.activeProjectId.set(null);
    this.setFilter('all');
    this.calendarDays = this.calendarDays.map(day => ({
      ...day,
      selected: day.date === date
    }));
  }

  setFilter(filter: TodoView): void {
    this.filter.set(filter);
  }

  addTodo(): void {
    if (this.todoForm.invalid) return;
    const { title: rawTitle, priority, dueDate } = this.todoForm.getRawValue();
    const title = rawTitle.trim();
    if (!title) return;
    this.facade.addTodo({
      title,
      priority,
      dueDate,
      projectId: this.activeProjectId() ?? 1
    });
    this.todoForm.reset();
    this.showComposer.set(false);
  }

  toggleTodo(id: number): void {
    const todo = this.todos().find(item => item.id === id);
    if (todo) this.facade.toggleTodo(id, !todo.completed);
  }

  deleteTodo(id: number): void {
    this.todoToDelete.set(this.todos().find(todo => todo.id === id) || null);
  }

  startEditing(todo: Todo): void {
    this.editingTodo.set(todo);
    this.editingTitle.set(todo.title);
  }

  cancelEditing(): void {
    this.editingTodo.set(null);
    this.editingTitle.set('');
  }

  saveEditing(): void {
    const todo = this.editingTodo();
    const title = this.editingTitle().trim();
    if (!todo || title.length < 3) return;
    this.facade.updateTodo(todo.id, { title });
    this.cancelEditing();
  }

  confirmDelete(): void {
    const todo = this.todoToDelete();
    if (!todo) return;
    this.facade.deleteTodo(todo.id);
    this.todoToDelete.set(null);
  }

  retryLoad(): void {
    this.facade.loadTodos();
  }

  formatDate(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.valueOf())
      ? 'No date'
      : new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
  }

  categoryColor(todo: Todo): string {
    return todo.category?.color || '#8b80ff';
  }

  openDialog(dialog: Exclude<WorkspaceDialog, null>): void {
    this.dialog.set(dialog);
    this.isSidebarOpen.set(false);
    if (dialog === 'notifications') {
      this.notifications.update(items => items.map(item => ({ ...item, read: true })));
    }
  }

  closeDialog(): void {
    this.dialog.set(null);
    this.showProjectComposer.set(false);
    this.todoToDelete.set(null);
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  setLanguage(language: 'en' | 'ar'): void {
    this.languageService.setLanguage(language);
  }

  @HostListener('window:keydown', ['$event'])
  handleKeyboardShortcuts(event: KeyboardEvent): void {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      this.searchInput?.nativeElement.focus();
    }

    if (event.key === 'Escape') {
      this.closeDialog();
      this.isSidebarOpen.set(false);
    }
  }

  private buildCalendarDays(): Array<{
    label: string;
    number: number;
    date: string;
    selected: boolean;
    muted: boolean;
    hasTask: boolean;
  }> {
    const today = new Date();
    const mondayOffset = (today.getDay() + 6) % 7;
    const monday = new Date(today);
    monday.setDate(today.getDate() - mondayOffset);

    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + index);
      const dateValue = this.dateKey(date);
      return {
        label: new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(date),
        number: date.getDate(),
        date: dateValue,
        selected: dateValue === this.selectedDate(),
        muted: date.getMonth() !== today.getMonth(),
        hasTask: this.todos().some(todo => this.dateKey(new Date(todo.dueDate)) === dateValue)
      };
    });
  }

  private buildWeekDays(): Array<{
    label: string;
    value: number;
    today: boolean;
    count: number;
  }> {
    const today = new Date();
    const mondayOffset = (today.getDay() + 6) % 7;
    const monday = new Date(today);
    monday.setDate(today.getDate() - mondayOffset);
    monday.setHours(0, 0, 0, 0);

    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + index);
      const dateValue = this.dateKey(date);
      const count = this.todos().filter(todo => this.dateKey(new Date(todo.dueDate)) === dateValue).length;

      return {
        label: new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(date),
        value: 0,
        today: dateValue === this.dateKey(today),
        count
      };
    });
    const maxCount = Math.max(...days.map(day => day.count), 0);

    return days.map(day => ({
      ...day,
      value: maxCount ? Math.max(12, Math.round((day.count / maxCount) * 100)) : 8
    }));
  }

  private dateKey(date: Date): string {
    if (Number.isNaN(date.valueOf())) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private withProjectColors(projects: Project[]): Array<Project & { color: string }> {
    return projects.map((project, index) => ({
      ...project,
      color: this.projectColor(index)
    }));
  }

  private projectColor(index: number): string {
    return ['#8b80ff', '#f3a66f', '#70d6a5', '#7ed0e8'][index % 4];
  }
}