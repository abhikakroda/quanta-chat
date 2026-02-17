import { useState } from "react";
import { CalendarDays, Plus, Trash2, CheckCircle2, Circle, Clock } from "lucide-react";

interface Task {
  id: string;
  title: string;
  description: string;
  dueDate: string;
  dueTime: string;
  completed: boolean;
  priority: "low" | "medium" | "high";
}

export default function TaskSchedulerTool() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");

  const addTask = () => {
    if (!title.trim()) return;
    setTasks((prev) => [...prev, { id: crypto.randomUUID(), title, description, dueDate, dueTime, completed: false, priority }]);
    setTitle(""); setDescription(""); setDueDate(""); setDueTime("");
  };

  const toggleTask = (id: string) => setTasks((prev) => prev.map((t) => t.id === id ? { ...t, completed: !t.completed } : t));
  const deleteTask = (id: string) => setTasks((prev) => prev.filter((t) => t.id !== id));

  const priorityColor = { low: "text-green-500", medium: "text-yellow-500", high: "text-red-500" };
  const sortedTasks = [...tasks].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    const pOrder = { high: 0, medium: 1, low: 2 };
    return pOrder[a.priority] - pOrder[b.priority];
  });

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4 animate-fade-in">
      <div className="flex items-center gap-2 mb-2">
        <CalendarDays className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">Task Scheduler</h2>
      </div>

      {/* Add task form */}
      <div className="bg-muted/30 border border-border rounded-2xl p-4 space-y-3">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Task title..." className="w-full bg-muted/50 border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-primary/30" />
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)" className="w-full bg-muted/50 border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-primary/30 resize-none min-h-[60px]" />
        <div className="flex flex-wrap gap-2">
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="bg-muted/50 border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none" />
          <input type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} className="bg-muted/50 border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none" />
          <select value={priority} onChange={(e) => setPriority(e.target.value as any)} className="bg-muted/50 border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none">
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
          <button onClick={addTask} disabled={!title.trim()} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-30 transition-opacity">
            <Plus className="w-4 h-4" /> Add Task
          </button>
        </div>
      </div>

      {/* Task list */}
      <div className="space-y-2">
        {sortedTasks.length === 0 && <p className="text-center text-muted-foreground text-sm py-8">No tasks yet. Add one above!</p>}
        {sortedTasks.map((task) => (
          <div key={task.id} className={`flex items-start gap-3 p-3 rounded-xl border border-border transition-colors ${task.completed ? "opacity-50 bg-muted/20" : "bg-muted/30"}`}>
            <button onClick={() => toggleTask(task.id)} className="mt-0.5 shrink-0">
              {task.completed ? <CheckCircle2 className="w-5 h-5 text-primary" /> : <Circle className="w-5 h-5 text-muted-foreground" />}
            </button>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium ${task.completed ? "line-through text-muted-foreground" : "text-foreground"}`}>{task.title}</p>
              {task.description && <p className="text-xs text-muted-foreground mt-0.5">{task.description}</p>}
              <div className="flex items-center gap-2 mt-1">
                {task.dueDate && <span className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="w-3 h-3" />{task.dueDate} {task.dueTime}</span>}
                <span className={`text-xs font-medium ${priorityColor[task.priority]}`}>{task.priority}</span>
              </div>
            </div>
            <button onClick={() => deleteTask(task.id)} className="p-1 rounded hover:text-destructive text-muted-foreground transition-colors">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
