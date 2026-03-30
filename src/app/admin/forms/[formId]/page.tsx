'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Trash2, Settings, Eye, Code2, Copy, Check,
  ChevronDown, Save, Loader2, ToggleLeft, ToggleRight,
  Type, AlignLeft, Mail, Phone, Hash, Calendar,
  List, CheckSquare, Users, Download, ExternalLink, GripVertical,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  closestCenter, DragStartEvent, DragEndEvent, DragOverEvent,
} from '@dnd-kit/core';
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

// ─── Types ────────────────────────────────────────────────────────────────────
type FieldType = 'text' | 'email' | 'phone' | 'textarea' | 'number' | 'date' | 'select' | 'checkbox' | 'multi_checkbox';

type FormField = {
  id: string;
  type: FieldType;
  label: string;
  placeholder: string;
  required: boolean;
  options: string[];
  propertyKey?: string;
  locked?: boolean; // email field — cannot be deleted
};

type ContactProperty = { key: string; label: string; type: string; group: string; builtin: boolean };

type FormRecord = {
  id: string; name: string; description: string;
  status: 'active' | 'draft'; submissionCount: number; fields: FormField[];
};

type Submission = { id: string; data: Record<string, string>; submittedAt: string; source: string };
type Tab = 'builder' | 'submissions' | 'share';

// ─── Field meta ──────────────────────────────────────────────────────────────
const FIELD_TYPES: { type: FieldType; label: string; icon: React.ElementType; desc: string }[] = [
  { type: 'text',     label: 'Short Text', icon: Type,        desc: 'Single line text' },
  { type: 'textarea', label: 'Long Text',  icon: AlignLeft,   desc: 'Multi-line text' },
  { type: 'email',    label: 'Email',      icon: Mail,        desc: 'Email address' },
  { type: 'phone',    label: 'Phone',      icon: Phone,       desc: 'Phone number' },
  { type: 'number',   label: 'Number',     icon: Hash,        desc: 'Numeric value' },
  { type: 'date',     label: 'Date',       icon: Calendar,    desc: 'Date picker' },
  { type: 'select',        label: 'Dropdown',        icon: List,        desc: 'Select one option' },
  { type: 'checkbox',      label: 'Checkbox',        icon: CheckSquare, desc: 'True / False' },
  { type: 'multi_checkbox', label: 'Multi-Select',   icon: CheckSquare, desc: 'Pick one or more options' },
];

const TYPE_TO_PROPERTY: Partial<Record<FieldType, string>> = {
  email: 'email', phone: 'phone',
};

// ─── Prebuilt field templates ─────────────────────────────────────────────────
type PrebuiltField = Omit<FormField, 'id'> & { prebuiltId: string };

const PREBUILT_FIELDS: PrebuiltField[] = [
  { prebuiltId: 'pb_firstname',    type: 'text',     label: 'First Name',         placeholder: 'Enter first name',      required: false, options: [], propertyKey: 'firstname' },
  { prebuiltId: 'pb_lastname',     type: 'text',     label: 'Last Name',          placeholder: 'Enter last name',       required: false, options: [], propertyKey: 'lastname' },
  { prebuiltId: 'pb_phone',        type: 'phone',    label: 'Phone Number',       placeholder: 'Enter phone number',    required: false, options: [], propertyKey: 'phone' },
  { prebuiltId: 'pb_company',      type: 'text',     label: 'Business Name',      placeholder: 'Enter business name',   required: false, options: [], propertyKey: 'businessName' },
  { prebuiltId: 'pb_jobtitle',     type: 'text',     label: 'Job Title',          placeholder: 'Enter job title',       required: false, options: [], propertyKey: 'jobtitle' },
  { prebuiltId: 'pb_website',      type: 'text',     label: 'Website URL',        placeholder: 'https://',              required: false, options: [], propertyKey: 'website' },
  { prebuiltId: 'pb_address',      type: 'text',     label: 'Street Address',     placeholder: 'Enter street address',  required: false, options: [], propertyKey: 'address' },
  { prebuiltId: 'pb_city',         type: 'text',     label: 'City',               placeholder: 'Enter city',            required: false, options: [], propertyKey: 'city' },
  { prebuiltId: 'pb_state',        type: 'text',     label: 'State',              placeholder: 'Enter state',           required: false, options: [], propertyKey: 'state' },
  { prebuiltId: 'pb_zip',          type: 'text',     label: 'ZIP Code',           placeholder: 'Enter ZIP code',        required: false, options: [], propertyKey: 'zip' },
  { prebuiltId: 'pb_industry',     type: 'text',     label: 'Industry',           placeholder: 'Enter industry',        required: false, options: [], propertyKey: 'industry' },
  { prebuiltId: 'pb_annualrev',    type: 'number',   label: 'Annual Revenue',     placeholder: '0',                     required: false, options: [], propertyKey: 'annualrevenue' },
  { prebuiltId: 'pb_employees',    type: 'number',   label: 'No. of Employees',   placeholder: '0',                     required: false, options: [], propertyKey: 'numemployees' },
  { prebuiltId: 'pb_message',      type: 'textarea', label: 'Message',            placeholder: 'Your message…',         required: false, options: [], propertyKey: 'message' },
  { prebuiltId: 'pb_pr',           type: 'text',     label: 'Program (PR)',           placeholder: '',                      required: false, options: [], propertyKey: 'pr' },
  // Grant-specific fields
  { prebuiltId: 'pb_fundinguse',   type: 'multi_checkbox', label: 'How will funds be used?', placeholder: '', required: false,
    options: ['Inventory', 'Payroll', 'Marketing', 'Rent / Operating Expenses', 'Expansion / New Location', 'Technology', 'Working Capital', 'Other'],
    propertyKey: 'fundinguse' },
  { prebuiltId: 'pb_monthlyrev',   type: 'select',   label: 'Monthly Revenue',        placeholder: '',                      required: false,
    options: ['Start Up', 'Under $5,000', '$5,000 – $20,000', '$20,000+'],
    propertyKey: 'grossMonthlyRevenue' },
  { prebuiltId: 'pb_state_select', type: 'select',   label: 'State',                  placeholder: '',                      required: false, options: [], propertyKey: 'state' },
];

function uid() { return Math.random().toString(36).slice(2, 10); }

function defaultField(type: FieldType): FormField {
  return {
    id: uid(), type,
    label: FIELD_TYPES.find(f => f.type === type)?.label ?? 'Field',
    placeholder: '', required: false,
    options: (type === 'select' || type === 'multi_checkbox') ? ['Option 1', 'Option 2'] : [],
    propertyKey: TYPE_TO_PROPERTY[type] ?? '',
  };
}

function adminHeaders() {
  const pw = typeof window !== 'undefined' ? (localStorage.getItem('usbg:adminToken') ?? '') : '';
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${pw}` };
}

// ─── FieldIcon ────────────────────────────────────────────────────────────────
function FieldIcon({ type, size = 14 }: { type: FieldType; size?: number }) {
  const found = FIELD_TYPES.find(f => f.type === type);
  if (!found) return null;
  const Icon = found.icon;
  return <Icon size={size} />;
}

// ─── Palette Draggable Item ───────────────────────────────────────────────────
function PaletteItem({ ft }: { ft: typeof FIELD_TYPES[0] }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette::${ft.type}`,
    data: { source: 'palette', fieldType: ft.type },
  });
  const Icon = ft.icon;

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{ opacity: isDragging ? 0.4 : 1 }}
      className="flex items-center gap-2.5 px-3 py-2.5 bg-white rounded-xl border border-slate-200 hover:border-[#93B5E1] hover:shadow-sm cursor-grab active:cursor-grabbing transition-all select-none group"
    >
      <div className="w-7 h-7 bg-[#EEF4FF] rounded-lg flex items-center justify-center shrink-0 group-hover:bg-[#0E468F] transition-colors">
        <Icon size={13} className="text-[#0E468F] group-hover:text-white transition-colors" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-700 leading-none">{ft.label}</p>
        <p className="text-[10px] text-slate-400 mt-0.5">{ft.desc}</p>
      </div>
    </div>
  );
}

// ─── Prebuilt Draggable Item ──────────────────────────────────────────────────
function PrebuiltItem({ pb, onAdd }: { pb: PrebuiltField; onAdd: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `prebuilt::${pb.prebuiltId}`,
    data: { source: 'prebuilt', prebuilt: pb },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onAdd}
      style={{ opacity: isDragging ? 0.4 : 1 }}
      className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-slate-200 hover:border-[#93B5E1] hover:bg-[#EEF4FF] cursor-grab active:cursor-grabbing transition-all select-none group"
    >
      <div className="w-1.5 h-1.5 rounded-full bg-[#0E468F] shrink-0 opacity-60" />
      <span className="text-xs font-medium text-slate-700 truncate group-hover:text-[#0E468F]">{pb.label}</span>
      {pb.propertyKey && (
        <span className="ml-auto text-[9px] text-slate-400 font-mono shrink-0">{pb.propertyKey}</span>
      )}
    </div>
  );
}

// ─── Drag Overlay Ghost ───────────────────────────────────────────────────────
function DragGhost({ type, label }: { type: FieldType; label: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-white rounded-xl border-2 border-[#0E468F] shadow-2xl w-64 rotate-2">
      <div className="w-8 h-8 bg-[#EEF4FF] rounded-lg flex items-center justify-center shrink-0">
        <FieldIcon type={type} size={15} />
      </div>
      <span className="text-sm font-semibold text-slate-800">{label}</span>
    </div>
  );
}

// ─── Sortable Field Card ──────────────────────────────────────────────────────
function SortableField({
  field, selected, onSelect, onRemove,
}: {
  field: FormField;
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: field.id,
    data: { source: 'canvas' },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div
        onClick={onSelect}
        className={`group bg-white rounded-xl border transition-all cursor-pointer ${
          selected
            ? 'border-[#0E468F] shadow-md ring-2 ring-[#93B5E1]/40'
            : 'border-slate-200 hover:border-slate-300 hover:shadow-sm'
        }`}
      >
        <div className="flex items-center gap-3 p-4">
          {/* Drag handle */}
          <button
            {...listeners}
            {...attributes}
            onClick={e => e.stopPropagation()}
            className="text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing p-0.5 shrink-0"
          >
            <GripVertical size={16} />
          </button>

          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
            selected ? 'bg-[#0E468F] text-white' : 'bg-slate-100 text-slate-500'
          }`}>
            <FieldIcon type={field.type} size={14} />
          </div>

          <div className="flex-1 min-w-0">
            <span className="text-sm font-semibold text-slate-800 block truncate">{field.label}</span>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className="text-[11px] text-slate-400">
                {FIELD_TYPES.find(f => f.type === field.type)?.label}
                {field.required && <span className="text-red-400 ml-1">· Required</span>}
              </span>
              {field.propertyKey && (
                <span className="text-[10px] px-1.5 py-0.5 bg-[#EEF4FF] text-[#0E468F] rounded-md font-mono">
                  → {field.propertyKey}
                </span>
              )}
            </div>
          </div>

          {field.locked ? (
            <span className="shrink-0 text-[10px] px-2 py-0.5 bg-amber-50 text-amber-600 border border-amber-200 rounded-full font-semibold">
              Required
            </span>
          ) : (
            <button
              onClick={e => { e.stopPropagation(); onRemove(); }}
              className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-50 text-red-400 rounded-lg transition-all shrink-0"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Drop Zone ────────────────────────────────────────────────────────────────
function DropZone({ isDragOver }: { isDragOver: boolean }) {
  return (
    <motion.div
      animate={{ borderColor: isDragOver ? '#0E468F' : '#e2e8f0', backgroundColor: isDragOver ? '#EEF4FF' : '#f8fafc' }}
      className="flex flex-col items-center justify-center min-h-[280px] rounded-2xl border-2 border-dashed transition-all"
    >
      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-3 transition-colors ${isDragOver ? 'bg-[#0E468F]' : 'bg-slate-200'}`}>
        {isDragOver
          ? <CheckSquare size={22} className="text-white" />
          : <GripVertical size={22} className="text-slate-400" />
        }
      </div>
      <p className={`font-semibold mb-1 transition-colors ${isDragOver ? 'text-[#0E468F]' : 'text-slate-500'}`}>
        {isDragOver ? 'Drop to add field' : 'Drag fields here'}
      </p>
      <p className="text-slate-400 text-sm">or click any field type on the left</p>
    </motion.div>
  );
}

// ─── Field Settings Panel ─────────────────────────────────────────────────────
function FieldSettings({
  field, properties, onUpdate, onClose, onRemove,
}: {
  field: FormField;
  properties: ContactProperty[];
  onUpdate: (patch: Partial<FormField>) => void;
  onClose: () => void;
  onRemove: () => void;
}) {
  const [propSearch, setPropSearch] = useState('');
  const [propOpen, setPropOpen] = useState(false);
  const propRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    function h(e: MouseEvent) {
      if (propRef.current && !propRef.current.contains(e.target as Node)) setPropOpen(false);
    }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const groups = React.useMemo(() => {
    const filtered = properties.filter(p =>
      !propSearch || p.label.toLowerCase().includes(propSearch.toLowerCase()) || p.key.toLowerCase().includes(propSearch.toLowerCase())
    );
    const map = new Map<string, ContactProperty[]>();
    for (const p of filtered) {
      const g = p.group || 'Other';
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(p);
    }
    return map;
  }, [properties, propSearch]);

  const selectedProp = properties.find(p => p.key === field.propertyKey);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-[#0E468F] rounded-lg flex items-center justify-center">
            <FieldIcon type={field.type} size={13} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-800">{FIELD_TYPES.find(f => f.type === field.type)?.label}</p>
            <p className="text-[10px] text-slate-400">Field settings</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {!field.locked && (
            <button onClick={onRemove} className="p-1 hover:bg-red-50 rounded-lg text-red-400 transition-colors">
              <Trash2 size={13} />
            </button>
          )}
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors text-xs font-bold">✕</button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {/* Label */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Label</label>
          <input
            value={field.label}
            onChange={e => onUpdate({ label: e.target.value })}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0E468F] focus:border-transparent"
          />
        </div>

        {/* Placeholder */}
        {field.type !== 'checkbox' && (
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Placeholder</label>
            <input
              value={field.placeholder}
              onChange={e => onUpdate({ placeholder: e.target.value })}
              placeholder="e.g. Enter your name…"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0E468F] focus:border-transparent"
            />
          </div>
        )}

        {/* Options (select / multi_checkbox) */}
        {(field.type === 'select' || field.type === 'multi_checkbox') && (
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Options (one per line)</label>
            <textarea
              value={field.options.join('\n')}
              onChange={e => onUpdate({ options: e.target.value.split('\n') })}
              rows={5}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0E468F] resize-none font-mono"
            />
          </div>
        )}

        {/* Required */}
        {field.locked ? (
          <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
            <div className="w-4 h-4 rounded bg-amber-400 flex items-center justify-center shrink-0">
              <Check size={10} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-amber-800">Always required</p>
              <p className="text-[11px] text-amber-600">Email is needed to link submissions to contacts</p>
            </div>
          </div>
        ) : (
          <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
            <input
              type="checkbox"
              checked={field.required}
              onChange={e => onUpdate({ required: e.target.checked })}
              className="w-4 h-4 rounded accent-[#0E468F]"
            />
            <div>
              <p className="text-sm font-semibold text-slate-700">Required field</p>
              <p className="text-[11px] text-slate-400">User must fill this in</p>
            </div>
          </label>
        )}

        {/* Contact property mapping */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Contact Property</label>
          <div ref={propRef} className="relative">
            <button
              type="button"
              onClick={() => setPropOpen(o => !o)}
              className={`w-full flex items-center justify-between px-3 py-2.5 text-sm border rounded-lg transition-colors text-left ${
                propOpen ? 'border-[#0E468F] ring-2 ring-[#93B5E1]/40' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <span className={selectedProp ? 'text-slate-800' : 'text-slate-400'}>
                {selectedProp
                  ? <span className="flex items-center gap-2">
                      <span className="font-medium">{selectedProp.label}</span>
                      <span className="text-[10px] text-slate-400 font-mono">{selectedProp.key}</span>
                    </span>
                  : 'Not mapped'}
              </span>
              <ChevronDown size={13} className={`text-slate-400 transition-transform shrink-0 ${propOpen ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
              {propOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.98 }}
                  className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden"
                >
                  <div className="p-2 border-b border-slate-100">
                    <input
                      autoFocus
                      value={propSearch}
                      onChange={e => setPropSearch(e.target.value)}
                      placeholder="Search properties…"
                      className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0E468F]"
                    />
                  </div>
                  <div className="max-h-52 overflow-y-auto">
                    <button
                      type="button"
                      onClick={() => { onUpdate({ propertyKey: '' }); setPropOpen(false); setPropSearch(''); }}
                      className={`w-full text-left px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 transition-colors ${!field.propertyKey ? 'bg-slate-50 font-semibold' : ''}`}
                    >
                      None
                    </button>
                    {Array.from(groups.entries()).map(([group, props]) => (
                      <div key={group}>
                        <div className="px-3 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider bg-slate-50">
                          {group}
                        </div>
                        {props.map(p => (
                          <button
                            key={p.key}
                            type="button"
                            onClick={() => { onUpdate({ propertyKey: p.key }); setPropOpen(false); setPropSearch(''); }}
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-[#EEF4FF] transition-colors flex items-center justify-between gap-2 ${
                              field.propertyKey === p.key ? 'bg-[#EEF4FF] text-[#0A3D83]' : 'text-slate-700'
                            }`}
                          >
                            <span>{p.label}</span>
                            <span className="text-[10px] text-slate-400 font-mono shrink-0">{p.key}</span>
                          </button>
                        ))}
                      </div>
                    ))}
                    {groups.size === 0 && (
                      <div className="px-3 py-4 text-center text-xs text-slate-400">No properties found</div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <p className="text-[10px] text-slate-400 mt-1.5">Submissions update this on the contact record</p>
        </div>
      </div>
    </div>
  );
}

// ─── ShareCard ────────────────────────────────────────────────────────────────
function ShareCard({ title, description, icon: Icon, code, onCopy, copied, action }: {
  title: string; description: string; icon: React.ElementType;
  code: string; onCopy: () => void; copied: boolean; action?: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="p-4 flex items-start justify-between gap-4 border-b border-slate-100">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 bg-[#EEF4FF] rounded-lg flex items-center justify-center text-[#0E468F] shrink-0">
            <Icon size={15} />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">{title}</p>
            <p className="text-xs text-slate-500 mt-0.5">{description}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {action}
          <button
            onClick={onCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0E468F] text-white text-xs font-semibold rounded-lg hover:bg-[#0A3D83] transition-colors"
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>
      <pre className="p-4 text-xs text-slate-600 bg-slate-50 overflow-x-auto whitespace-pre-wrap break-all font-mono leading-relaxed">
        {code}
      </pre>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function FormEditorPage() {
  const { formId } = useParams<{ formId: string }>();
  const router = useRouter();

  const [form, setForm]           = useState<FormRecord | null>(null);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [savedOk, setSavedOk]     = useState(false);
  const [tab, setTab]             = useState<Tab>('builder');
  const [selectedField, setSelectedField] = useState<string | null>(null);
  const [properties, setProperties] = useState<ContactProperty[]>([]);

  // submissions
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [subsLoading, setSubsLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // share copy state
  const [copiedEmbed, setCopiedEmbed] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // dnd state
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isDragOverCanvas, setIsDragOverCanvas] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  // ── Load
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [formRes, propsRes] = await Promise.all([
          fetch(`/api/admin/forms/${formId}`, { headers: adminHeaders() }),
          fetch('/api/admin/contact-properties', { headers: adminHeaders() }),
        ]);
        const data = await formRes.json();
        setForm({ ...data, fields: data.fields ?? [] });
        const propsData = await propsRes.json();
        setProperties(propsData.properties ?? []);
      } finally { setLoading(false); }
    })();
  }, [formId]);

  useEffect(() => {
    if (tab !== 'submissions') return;
    (async () => {
      setSubsLoading(true);
      try {
        const res = await fetch(`/api/admin/forms/${formId}/submissions`, { headers: adminHeaders() });
        const data = await res.json();
        setSubmissions(data.submissions ?? []);
      } finally { setSubsLoading(false); }
    })();
  }, [tab, formId]);

  const save = useCallback(async (patch?: Partial<FormRecord>) => {
    if (!form) return;
    setSaving(true);
    const merged = { ...form, ...patch };
    try {
      await fetch(`/api/admin/forms/${formId}`, {
        method: 'PUT', headers: adminHeaders(),
        body: JSON.stringify({ name: merged.name, description: merged.description, fields: merged.fields, status: merged.status }),
      });
      if (patch) setForm(merged);
      setSavedOk(true);
      setTimeout(() => setSavedOk(false), 2000);
    } finally { setSaving(false); }
  }, [form, formId]);

  function updateField(id: string, patch: Partial<FormField>) {
    if (!form) return;
    setForm({ ...form, fields: form.fields.map(f => f.id === id ? { ...f, ...patch } : f) });
  }

  function removeField(id: string) {
    if (!form) return;
    const field = form.fields.find(f => f.id === id);
    if (field?.locked) return; // email field is locked
    setForm({ ...form, fields: form.fields.filter(f => f.id !== id) });
    if (selectedField === id) setSelectedField(null);
  }

  function addPrebuiltField(pb: PrebuiltField, insertBeforeId?: string) {
    if (!form) return;
    const newField: FormField = { ...pb, id: uid() };
    delete (newField as { prebuiltId?: string }).prebuiltId;
    let fields = [...form.fields];
    if (insertBeforeId) {
      const idx = fields.findIndex(f => f.id === insertBeforeId);
      if (idx >= 0) { fields.splice(idx, 0, newField); }
      else { fields.push(newField); }
    } else {
      fields.push(newField);
    }
    setForm({ ...form, fields });
    setSelectedField(newField.id);
  }

  // ── DnD handlers
  function handleDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  function handleDragOver(e: DragOverEvent) {
    setIsDragOverCanvas(!!e.over);
  }

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    setActiveId(null);
    setIsDragOverCanvas(false);
    if (!form || !active) return;

    const src = (active.data.current as { source: string })?.source;

    if (src === 'prebuilt') {
      const pb = (active.data.current as { prebuilt: PrebuiltField }).prebuilt;
      addPrebuiltField(pb, over && over.id !== 'canvas-drop' ? String(over.id) : undefined);
      return;
    }

    if (src === 'palette') {
      // Drop from palette → add new field
      const fieldType = (active.data.current as { fieldType: FieldType }).fieldType;
      const newField = defaultField(fieldType);

      let fields = [...form.fields];
      if (over && over.id !== 'canvas-drop') {
        // Insert before the hovered field
        const idx = fields.findIndex(f => f.id === over.id);
        if (idx >= 0) { fields.splice(idx, 0, newField); }
        else { fields.push(newField); }
      } else {
        fields.push(newField);
      }
      setForm({ ...form, fields });
      setSelectedField(newField.id);

    } else if (src === 'canvas' && over && active.id !== over.id) {
      // Reorder within canvas
      const oldIdx = form.fields.findIndex(f => f.id === active.id);
      const newIdx = form.fields.findIndex(f => f.id === over.id);
      if (oldIdx >= 0 && newIdx >= 0) {
        setForm({ ...form, fields: arrayMove(form.fields, oldIdx, newIdx) });
      }
    }
  }

  // Embed strings
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://yoursite.com';
  const publicUrl = `${origin}/f/${formId}`;
  const iframeCode = `<iframe src="${publicUrl}" width="100%" height="600" frameborder="0" style="border:none;border-radius:12px;"></iframe>`;
  const scriptCode = `<div id="usbg-form-${formId}"></div>\n<script src="${origin}/form-embed.js" data-form="${formId}" data-target="usbg-form-${formId}"></script>`;

  function copyText(text: string, which: 'embed' | 'script' | 'link') {
    navigator.clipboard.writeText(text);
    if (which === 'embed')  { setCopiedEmbed(true);  setTimeout(() => setCopiedEmbed(false),  2000); }
    if (which === 'script') { setCopiedScript(true); setTimeout(() => setCopiedScript(false), 2000); }
    if (which === 'link')   { setCopiedLink(true);   setTimeout(() => setCopiedLink(false),   2000); }
  }

  async function deleteSubmission(id: string) {
    setDeletingId(id);
    await fetch(`/api/admin/forms/${formId}/submissions?id=${id}`, { method: 'DELETE', headers: adminHeaders() });
    setSubmissions(s => s.filter(x => x.id !== id));
    setForm(f => f ? { ...f, submissionCount: Math.max(0, (f.submissionCount ?? 1) - 1) } : f);
    setDeletingId(null);
  }

  async function deleteAllSubmissions() {
    if (!confirm(`Delete all ${submissions.length} submissions? This cannot be undone.`)) return;
    await fetch(`/api/admin/forms/${formId}/submissions?all=1`, { method: 'DELETE', headers: adminHeaders() });
    setSubmissions([]);
    setForm(f => f ? { ...f, submissionCount: 0 } : f);
  }

  function exportCSV() {
    if (!submissions.length || !form) return;
    const headers = form.fields.map(f => f.label);
    const rows = submissions.map(s =>
      form.fields.map(f => `"${String(s.data?.[f.id] ?? s.data?.[f.label] ?? '').replace(/"/g, '""')}"`).join(',')
    );
    const csv = [['Submitted At', ...headers].join(','),
      ...submissions.map((s, i) => [`"${s.submittedAt}"`, ...rows[i].split(',')].join(','))
    ].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `${form.name}-submissions.csv`;
    a.click();
  }

  if (loading || !form) {
    return (
      <div className="flex items-center justify-center h-full min-h-[60vh]">
        <Loader2 size={28} className="animate-spin text-[#0E468F]" />
      </div>
    );
  }

  const selField = form.fields.find(f => f.id === selectedField) ?? null;
  const activePaletteType = activeId?.startsWith('palette::')
    ? (activeId.replace('palette::', '') as FieldType)
    : activeId?.startsWith('prebuilt::')
    ? 'text' as FieldType  // use text icon for prebuilt ghost
    : null;
  const activePrebuiltLabel = activeId?.startsWith('prebuilt::')
    ? PREBUILT_FIELDS.find(p => `prebuilt::${p.prebuiltId}` === activeId)?.label ?? ''
    : null;
  const activeCanvasField = activeId && !activeId.startsWith('palette::')
    ? form.fields.find(f => f.id === activeId)
    : null;

  return (
    <div className="flex flex-col h-full min-h-screen bg-slate-50">

      {/* ── Top bar ── */}
      <div className="bg-white border-b border-slate-100 px-6 py-3.5 flex items-center gap-4 sticky top-0 z-20 shadow-sm">
        <button onClick={() => router.push('/admin/forms')} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <input
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            className="text-lg font-bold text-slate-900 bg-transparent outline-none w-full"
            placeholder="Form name…"
          />
        </div>
        <button
          onClick={() => save({ ...form, status: form.status === 'active' ? 'draft' : 'active' })}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            form.status === 'active' ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          {form.status === 'active' ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
          {form.status === 'active' ? 'Active' : 'Draft'}
        </button>
        <a
          href={`/f/${formId}`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors"
        >
          <Eye size={14} />
          View
        </a>
        <button
          onClick={() => save()}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-[#0E468F] text-white rounded-lg text-sm font-semibold hover:bg-[#0A3D83] disabled:opacity-60 transition-colors"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : savedOk ? <Check size={14} /> : <Save size={14} />}
          {savedOk ? 'Saved!' : 'Save'}
        </button>
      </div>

      {/* ── Tabs ── */}
      <div className="bg-white border-b border-slate-100 px-6">
        <div className="flex gap-1">
          {([
            { key: 'builder',     label: 'Builder',     icon: Settings },
            { key: 'submissions', label: `Submissions${form.submissionCount ? ` (${form.submissionCount})` : ''}`, icon: Users },
            { key: 'share',       label: 'Share & Embed', icon: Code2 },
          ] as { key: Tab; label: string; icon: React.ElementType }[]).map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  tab === t.key ? 'border-[#0E468F] text-[#0E468F]' : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <Icon size={14} />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-hidden">

        {/* ── BUILDER TAB ── */}
        {tab === 'builder' && (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <div className="flex h-full">

              {/* Left: Palette */}
              <div className="w-60 bg-white border-r border-slate-100 shrink-0 overflow-y-auto flex flex-col">
                <div className="p-4 space-y-4">
                  {/* Field Types */}
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">Field Types</p>
                    <div className="space-y-1.5">
                      {FIELD_TYPES.map(ft => (
                        <PaletteItem
                          key={ft.type}
                          ft={ft}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Prebuilt Fields */}
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">Prebuilt Fields</p>
                    <p className="text-[10px] text-slate-300 mb-2 px-1">Auto-mapped to contact properties</p>
                    <div className="space-y-1">
                      {PREBUILT_FIELDS.map(pb => (
                        <PrebuiltItem
                          key={pb.prebuiltId}
                          pb={pb}
                          onAdd={() => addPrebuiltField(pb)}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Center: Canvas */}
              <div className="flex-1 overflow-y-auto p-6">
                <SortableContext items={form.fields.map(f => f.id)} strategy={verticalListSortingStrategy}>
                  <div className="max-w-2xl mx-auto space-y-2.5">
                    {form.fields.length === 0 ? (
                      <DropZone isDragOver={isDragOverCanvas} />
                    ) : (
                      <>
                        {form.fields.map(field => (
                          <SortableField
                            key={field.id}
                            field={field}
                            selected={selectedField === field.id}
                            onSelect={() => setSelectedField(selectedField === field.id ? null : field.id)}
                            onRemove={() => removeField(field.id)}
                          />
                        ))}

                        {/* Bottom drop zone when canvas has fields */}
                        {isDragOverCanvas && activePaletteType && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 56 }}
                            className="rounded-xl border-2 border-dashed border-[#0E468F] bg-[#EEF4FF] flex items-center justify-center text-sm text-[#0E468F] font-medium"
                          >
                            Drop here to add at end
                          </motion.div>
                        )}

                        {/* Add more hint */}
                        <div className="text-center pt-2 pb-4">
                          <p className="text-xs text-slate-400">Drag more fields from the left panel</p>
                        </div>
                      </>
                    )}
                  </div>
                </SortableContext>
              </div>

              {/* Right: Settings or Preview */}
              <div className="w-72 bg-white border-l border-slate-100 shrink-0 overflow-y-auto">
                <AnimatePresence mode="wait">
                  {selField ? (
                    <motion.div
                      key={selField.id}
                      initial={{ opacity: 0, x: 12 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 12 }}
                      className="h-full"
                    >
                      <FieldSettings
                        field={selField}
                        properties={properties}
                        onUpdate={patch => updateField(selField.id, patch)}
                        onClose={() => setSelectedField(null)}
                        onRemove={() => { removeField(selField.id); setSelectedField(null); }}
                      />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="preview"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="p-5"
                    >
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Live Preview</p>
                      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                        <div className="px-5 py-4" style={{ background: 'linear-gradient(135deg, #0E468F 0%, #032D67 100%)' }}>
                          <h3 className="text-sm font-bold text-white">{form.name || 'Untitled Form'}</h3>
                          {form.description && <p className="text-xs text-blue-200 mt-0.5">{form.description}</p>}
                        </div>
                        <div className="p-4 space-y-3">
                          {form.fields.length === 0 ? (
                            <p className="text-xs text-slate-400 text-center py-4">No fields yet</p>
                          ) : (
                            form.fields.map(field => (
                              <div key={field.id}>
                                <label className="block text-xs font-semibold text-[#1F315C] mb-1">
                                  {field.label}{field.required && <span className="text-red-500 ml-0.5">*</span>}
                                </label>
                                {field.type === 'textarea' ? (
                                  <textarea disabled placeholder={field.placeholder || field.label} rows={2}
                                    className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-slate-50 resize-none" />
                                ) : field.type === 'select' ? (
                                  <select disabled className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-slate-50">
                                    <option>Select…</option>
                                    {field.options.filter(Boolean).map(o => <option key={o}>{o}</option>)}
                                  </select>
                                ) : field.type === 'checkbox' ? (
                                  <label className="flex items-center gap-2 text-xs text-slate-600">
                                    <input type="checkbox" disabled className="rounded" />{field.label}
                                  </label>
                                ) : (
                                  <input disabled type={field.type} placeholder={field.placeholder || field.label}
                                    className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-slate-50" />
                                )}
                              </div>
                            ))
                          )}
                          {form.fields.length > 0 && (
                            <button disabled className="w-full py-2 text-white text-xs font-semibold rounded-lg opacity-80"
                              style={{ background: 'linear-gradient(135deg, #0E468F, #032D67)' }}>
                              Submit
                            </button>
                          )}
                        </div>
                      </div>
                      {!selField && form.fields.length > 0 && (
                        <p className="text-[10px] text-slate-400 text-center mt-3">Click a field to edit its settings</p>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Drag overlay */}
            <DragOverlay dropAnimation={{ duration: 150, easing: 'ease' }}>
              {activePaletteType && (
                <DragGhost
                  type={activePaletteType}
                  label={activePrebuiltLabel ?? FIELD_TYPES.find(f => f.type === activePaletteType)?.label ?? ''}
                />
              )}
              {activeCanvasField && (
                <div className="bg-white rounded-xl border-2 border-[#0E468F] shadow-2xl p-4 w-full max-w-2xl opacity-90">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-[#0E468F] rounded-lg flex items-center justify-center shrink-0">
                      <FieldIcon type={activeCanvasField.type} size={14} />
                    </div>
                    <span className="text-sm font-semibold text-slate-800">{activeCanvasField.label}</span>
                  </div>
                </div>
              )}
            </DragOverlay>
          </DndContext>
        )}

        {/* ── SUBMISSIONS TAB ── */}
        {tab === 'submissions' && (
          <div className="p-6 max-w-6xl mx-auto overflow-auto">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-base font-bold text-slate-900">Submissions</h2>
                <p className="text-sm text-slate-500">{form.submissionCount ?? 0} total</p>
              </div>
              {submissions.length > 0 && (
                <div className="flex items-center gap-2">
                  <button onClick={exportCSV} className="flex items-center gap-2 px-3 py-2 border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">
                    <Download size={14} /> Export CSV
                  </button>
                  <button onClick={deleteAllSubmissions} className="flex items-center gap-2 px-3 py-2 border border-red-200 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors">
                    <Trash2 size={14} /> Delete All
                  </button>
                </div>
              )}
            </div>
            {subsLoading ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="bg-white rounded-xl border border-slate-100 p-4 animate-pulse">
                    <div className="h-3 bg-slate-200 rounded w-32 mb-2" />
                    <div className="h-3 bg-slate-100 rounded w-full" />
                  </div>
                ))}
              </div>
            ) : submissions.length === 0 ? (
              <div className="text-center py-20">
                <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <Users size={24} className="text-slate-400" />
                </div>
                <p className="text-slate-600 font-medium">No submissions yet</p>
                <p className="text-slate-400 text-sm mt-1">Share your form to start collecting responses</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        <th className="w-10 px-4 py-3" />
                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 whitespace-nowrap">Submitted</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 whitespace-nowrap">Source</th>
                        {form.fields.map(f => (
                          <th key={f.id} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 whitespace-nowrap">{f.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {submissions.map((sub, i) => (
                        <tr key={sub.id} className={`border-b border-slate-50 hover:bg-slate-50 transition-colors group ${i % 2 === 0 ? '' : 'bg-slate-50/30'}`}>
                          <td className="px-3 py-3">
                            <button
                              onClick={() => deleteSubmission(sub.id)}
                              disabled={deletingId === sub.id}
                              className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-50 text-red-400 rounded-lg transition-all"
                            >
                              {deletingId === sub.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                            </button>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                            {sub.submittedAt ? new Date(sub.submittedAt).toLocaleString() : '—'}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-400 max-w-[140px] truncate" title={sub.source}>
                            {(() => { try { return new URL(sub.source).hostname; } catch { return sub.source || '—'; } })()}
                          </td>
                          {form.fields.map(f => (
                            <td key={f.id} className="px-4 py-3 text-sm text-slate-700 max-w-[200px] truncate">
                              {sub.data?.[f.id] ?? sub.data?.[f.label] ?? '—'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── SHARE TAB ── */}
        {tab === 'share' && (
          <div className="p-6 max-w-2xl mx-auto space-y-5 overflow-auto">
            {form.status !== 'active' && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                <div className="text-amber-500 mt-0.5">⚠️</div>
                <div>
                  <p className="text-sm font-semibold text-amber-800">Form is in Draft mode</p>
                  <p className="text-xs text-amber-600 mt-0.5">Activate the form before sharing to accept submissions.</p>
                </div>
                <button onClick={() => save({ ...form, status: 'active' })}
                  className="ml-auto shrink-0 px-3 py-1.5 bg-amber-500 text-white text-xs font-semibold rounded-lg hover:bg-amber-600 transition-colors">
                  Activate
                </button>
              </div>
            )}
            <ShareCard title="Direct Link" description="Share this URL directly — opens a standalone form page"
              icon={ExternalLink} code={publicUrl} onCopy={() => copyText(publicUrl, 'link')} copied={copiedLink}
              action={
                <a href={publicUrl} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#0E468F] hover:bg-[#EEF4FF] rounded-lg transition-colors">
                  <Eye size={12} /> Preview
                </a>
              }
            />
            <ShareCard title="iFrame Embed" description="Paste into any HTML page to embed the form directly"
              icon={Code2} code={iframeCode} onCopy={() => copyText(iframeCode, 'embed')} copied={copiedEmbed} />
            <ShareCard title="Script Embed" description="Dynamic embed — renders inside a div without an iframe"
              icon={Code2} code={scriptCode} onCopy={() => copyText(scriptCode, 'script')} copied={copiedScript} />
          </div>
        )}
      </div>
    </div>
  );
}
