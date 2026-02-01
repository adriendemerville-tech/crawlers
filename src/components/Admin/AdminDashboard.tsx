import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, FileText, BarChart3, MessageSquare, Shield } from 'lucide-react';
import { AdminUserManagement } from './AdminUserManagement';
import { AdminBlogManager } from './AdminBlogManager';
import { AdminAnalytics } from './AdminAnalytics';
import { AdminSupport } from './AdminSupport';

const translations = {
  fr: {
    title: 'Back-Office Administration',
    description: 'Gérez les utilisateurs, le contenu et les statistiques',
    users: 'Utilisateurs',
    blog: 'Articles',
    analytics: 'Statistiques',
    support: 'SAV',
  },
  en: {
    title: 'Admin Back-Office',
    description: 'Manage users, content and statistics',
    users: 'Users',
    blog: 'Articles',
    analytics: 'Analytics',
    support: 'Support',
  },
  es: {
    title: 'Back-Office Administración',
    description: 'Gestiona usuarios, contenido y estadísticas',
    users: 'Usuarios',
    blog: 'Artículos',
    analytics: 'Estadísticas',
    support: 'Soporte',
  },
};

interface AdminDashboardProps {
  language: 'fr' | 'en' | 'es';
}

export function AdminDashboard({ language }: AdminDashboardProps) {
  const t = translations[language];
  const [activeTab, setActiveTab] = useState('users');

  return (
    <Card className="border-2 border-primary/20">
      <CardHeader className="bg-primary/5">
        <div className="flex items-center gap-3">
          <Shield className="h-6 w-6 text-primary" />
          <div>
            <CardTitle>{t.title}</CardTitle>
            <CardDescription>{t.description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="users" className="gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">{t.users}</span>
            </TabsTrigger>
            <TabsTrigger value="blog" className="gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">{t.blog}</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">{t.analytics}</span>
            </TabsTrigger>
            <TabsTrigger value="support" className="gap-2">
              <MessageSquare className="h-4 w-4" />
              <span className="hidden sm:inline">{t.support}</span>
            </TabsTrigger>
          </TabsList>

          <div className="mt-6">
            <TabsContent value="users">
              <AdminUserManagement language={language} />
            </TabsContent>
            <TabsContent value="blog">
              <AdminBlogManager language={language} />
            </TabsContent>
            <TabsContent value="analytics">
              <AdminAnalytics language={language} />
            </TabsContent>
            <TabsContent value="support">
              <AdminSupport language={language} />
            </TabsContent>
          </div>
        </Tabs>
      </CardContent>
    </Card>
  );
}
