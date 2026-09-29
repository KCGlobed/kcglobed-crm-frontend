import React from 'react';
import {
  LayoutDashboard,
  LayoutGrid,
  Users,
  User,
  Network,
  SettingsIcon,
  ShieldCheck,
  Boxes,
  BarChart3,
  PieChart,
  GraduationCap,
  MessageSquare,
  FileText,
  Home,
  Folder,
  Bell,
  Calendar,
  Phone,
  Mail,
} from 'lucide-react';

// Backend sends icon names in mixed styles ("Users" lucide-style,
// "FiNetwork" react-icons Feather-style). Keys are lowercase with the
// "fi" prefix stripped; unknown/empty names fall back to LayoutGrid.
const ICON_MAP: Record<string, React.ReactNode> = {
  dashboard: <LayoutDashboard size={19} />,
  layoutdashboard: <LayoutDashboard size={19} />,
  home: <Home size={19} />,
  users: <Users size={19} />,
  user: <User size={19} />,
  network: <Network size={19} />,
  share2: <Network size={19} />,
  settings: <SettingsIcon size={19} />,
  settingsicon: <SettingsIcon size={19} />,
  shield: <ShieldCheck size={19} />,
  shieldcheck: <ShieldCheck size={19} />,
  lock: <ShieldCheck size={19} />,
  box: <Boxes size={19} />,
  boxes: <Boxes size={19} />,
  grid: <LayoutGrid size={19} />,
  layoutgrid: <LayoutGrid size={19} />,
  barchart: <BarChart3 size={19} />,
  barchart2: <BarChart3 size={19} />,
  barchart3: <BarChart3 size={19} />,
  piechart: <PieChart size={19} />,
  graduationcap: <GraduationCap size={19} />,
  messagesquare: <MessageSquare size={19} />,
  filetext: <FileText size={19} />,
  folder: <Folder size={19} />,
  bell: <Bell size={19} />,
  calendar: <Calendar size={19} />,
  phone: <Phone size={19} />,
  mail: <Mail size={19} />,
};

export const getMenuIcon = (name?: string): React.ReactNode => {
  if (!name) return <LayoutGrid size={19} />;
  const key = name.toLowerCase();
  return ICON_MAP[key] || ICON_MAP[key.replace(/^fi/, '')] || <LayoutGrid size={19} />;
};

export default getMenuIcon;
