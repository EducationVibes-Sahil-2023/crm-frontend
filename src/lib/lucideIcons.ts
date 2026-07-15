// Curated lucide-react icon set for the admin menu customizer. Modern, clean
// icons the super-admin can assign to any menu item. Keys are kebab-case and
// stored in the menu config; the layout + picker resolve them through here.

import {
  LayoutDashboard, LayoutGrid, House, Building2, Briefcase, Users, UserPlus, UserRound, CircleUser, Contact,
  Calendar, CalendarDays, CalendarPlus, Clock,
  Mail, MailOpen, MessageSquare, MessageCircle, Send, Bell, BellRing, Phone, PhoneCall, Video, Megaphone,
  Settings, Settings2, SlidersHorizontal, Wrench, Cog,
  BarChart3, ChartLine, ChartPie, TrendingUp, Activity, Gauge,
  CreditCard, Wallet, DollarSign, Receipt, Banknote,
  Shield, ShieldCheck, Lock, KeyRound, Fingerprint,
  FileText, Folder, FolderPlus, Files, ClipboardList,
  Image, Camera, Film, Music, Mic,
  Globe, Link, ExternalLink, Cloud, Server, Database, Cpu, Plug,
  Sparkles, Star, Heart, Zap, Rocket, Flame, Award, Trophy, Crown, Gift, Bookmark, Tag, Target, Compass, Map, MapPin,
  Search, Filter, Inbox, Archive, Trash2, Download, Upload, Share2, RefreshCw, Plus,
  Package, ShoppingCart, Truck, Box, Layers,
  Bot, BrainCircuit, Wand2, LifeBuoy, Ticket, CircleHelp, Info, CircleCheckBig, Bug,
  Sun, Moon, Palette, Eye, ThumbsUp, Smile,
  Store, Landmark, Factory, BookOpen, GraduationCap, Newspaper,
  Smartphone, Monitor, Laptop, Circle,
  Pencil, List, TriangleAlert,
  type LucideIcon,
} from "lucide-react";

export const LUCIDE_ICONS: Record<string, LucideIcon> = {
  "layout-dashboard": LayoutDashboard, "layout-grid": LayoutGrid, house: House, "building-2": Building2, briefcase: Briefcase,
  users: Users, "user-plus": UserPlus, "user-round": UserRound, "circle-user": CircleUser, contact: Contact,
  calendar: Calendar, "calendar-days": CalendarDays, "calendar-plus": CalendarPlus, clock: Clock,
  mail: Mail, "mail-open": MailOpen, "message-square": MessageSquare, "message-circle": MessageCircle, send: Send,
  bell: Bell, "bell-ring": BellRing, phone: Phone, "phone-call": PhoneCall, video: Video, megaphone: Megaphone,
  settings: Settings, "settings-2": Settings2, sliders: SlidersHorizontal, wrench: Wrench, cog: Cog,
  "bar-chart": BarChart3, "chart-line": ChartLine, "chart-pie": ChartPie, "trending-up": TrendingUp, activity: Activity, gauge: Gauge,
  "credit-card": CreditCard, wallet: Wallet, "dollar-sign": DollarSign, receipt: Receipt, banknote: Banknote,
  shield: Shield, "shield-check": ShieldCheck, lock: Lock, key: KeyRound, fingerprint: Fingerprint,
  "file-text": FileText, folder: Folder, "folder-plus": FolderPlus, files: Files, clipboard: ClipboardList,
  image: Image, camera: Camera, film: Film, music: Music, mic: Mic,
  globe: Globe, link: Link, "external-link": ExternalLink, cloud: Cloud, server: Server, database: Database, cpu: Cpu, plug: Plug,
  sparkles: Sparkles, star: Star, heart: Heart, zap: Zap, rocket: Rocket, flame: Flame, award: Award, trophy: Trophy,
  crown: Crown, gift: Gift, bookmark: Bookmark, tag: Tag, target: Target, compass: Compass, map: Map, "map-pin": MapPin,
  search: Search, filter: Filter, inbox: Inbox, archive: Archive, trash: Trash2, download: Download, upload: Upload,
  share: Share2, refresh: RefreshCw, plus: Plus,
  package: Package, "shopping-cart": ShoppingCart, truck: Truck, box: Box, layers: Layers,
  bot: Bot, "brain-circuit": BrainCircuit, wand: Wand2, "life-buoy": LifeBuoy, ticket: Ticket, help: CircleHelp,
  info: Info, "check-circle": CircleCheckBig, bug: Bug,
  sun: Sun, moon: Moon, palette: Palette, eye: Eye, "thumbs-up": ThumbsUp, smile: Smile,
  store: Store, landmark: Landmark, factory: Factory, "book-open": BookOpen, "graduation-cap": GraduationCap, newspaper: Newspaper,
  smartphone: Smartphone, monitor: Monitor, laptop: Laptop, circle: Circle,
  pencil: Pencil, list: List, alert: TriangleAlert,
};

export const LUCIDE_ICON_KEYS = Object.keys(LUCIDE_ICONS);

/** Resolve a stored icon key to a lucide component, falling back to a circle. */
export function getLucide(key: string): LucideIcon {
  return LUCIDE_ICONS[key] ?? Circle;
}

// Map the project's original custom icon names (lib/icons) → a lucide key, so
// the client sidebar can render the modern lucide set without rewriting every
// nav definition. Unmapped names fall back to a circle.
const CUSTOM_TO_LUCIDE: Record<string, string> = {
  dashboard: "layout-dashboard", leads: "contact", task: "clipboard", gmail: "mail", chat: "message-square",
  media: "image", announcement: "megaphone", calendar: "calendar-days", call: "phone-call", visitor: "eye",
  ticket: "ticket", quotation: "receipt", payment: "credit-card", asset: "box", knowledge: "book-open",
  users: "users", settings: "settings", eye: "eye", edit: "pencil", trash: "trash", pin: "map-pin",
  briefcase: "briefcase", search: "search", bell: "bell", message: "message-square", chevronDown: "circle",
  export: "external-link", menu: "list", logout: "circle", revenue: "dollar-sign", trendUp: "trending-up",
  deals: "tag", win: "trophy", folder: "folder", folderPlus: "folder-plus", upload: "upload", download: "download",
  image: "image", video: "film", audio: "music", fileText: "file-text", grid: "layout-grid", list: "list",
  arrowLeft: "circle", close: "circle", more: "circle", send: "send", smile: "smile", paperclip: "link",
  phone: "phone", videoCam: "film", check: "check-circle", checkDouble: "check-circle", plus: "plus",
  mic: "mic", micOff: "mic", videoOff: "film", screenShare: "monitor", expand: "layers", star: "star",
  activity: "activity", clock: "clock", alert: "alert", refresh: "refresh", tag: "tag", inventory: "package",
  camera: "camera", shield: "shield", key: "key", link: "link", android: "smartphone", apple: "smartphone",
  ai: "sparkles", whatsapp: "message-circle", plug: "plug",
};

/** Lucide component for one of the project's original custom icon names. */
export function getLucideForCustom(name: string): LucideIcon {
  return getLucide(CUSTOM_TO_LUCIDE[name] ?? "circle");
}
