'use client';
import { api } from '@repo/convex/_generated/api';
import { Button } from '@repo/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/ui/dialog';
import { Input } from '@repo/ui/components/ui/input';
import { Label } from '@repo/ui/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@repo/ui/components/ui/table';
import { IconCrown, IconPencil, IconTrash, IconUser } from '@tabler/icons-react';
import { useMutation, useQuery } from 'convex/react';
import Image from 'next/image';
import { useState } from 'react';
import { Toaster, toast } from 'sonner';

export default function UserPage() {
  const getAllUsers = useQuery(api.users.getAllUsers);
  const updateUserMutation = useMutation(api.users.updateUser);

  const [isOpen, setIsOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleEditClick = (user: any) => {
    setEditingUser(user);
    setEditName(user.name || '');
    setEditEmail(user.email || '');
    setEditRole(user.role || 'user');
    setIsOpen(true);
  };

  const handleDiscard = () => {
    setEditingUser(null);
    setEditName('');
    setEditEmail('');
    setEditRole('');
    setIsOpen(false);
    toast.info('Changes discarded');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    setIsSubmitting(true);
    try {
      await updateUserMutation({
        clerkId: editingUser.clerkId,
        name: editName,
        email: editEmail,
        role: editRole,
      });
      toast.success(`Successfully updated ${editName}'s details`);
      setEditingUser(null);
      setIsOpen(false);
    } catch (error) {
      console.error('Error updating user:', error);
      toast.error('Failed to update user. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 p-6 relative">
      <Toaster richColors position="top-right" />

      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">User Management</h1>
        <p className="text-muted-foreground text-sm">
          Manage users, permissions, and administrator privileges.
        </p>
      </div>

      {/* Table 1: Admins */}
      <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
        <div className="p-4 border-b border-border bg-muted/40">
          <h2 className="font-semibold text-lg flex items-center gap-2">
            <IconCrown className="text-amber-500 w-5 h-5" />
            Admins
          </h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px]" />
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Join Date</TableHead>
              <TableHead className="w-[120px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {getAllUsers
              ?.filter((user) => user.role === 'admin')
              .map((user) => (
                <TableRow key={user._id} className="hover:bg-muted/30 transition-colors">
                  <TableCell>
                    <Image
                      src={user.imageUrl}
                      alt={user.name}
                      width={40}
                      height={40}
                      className="rounded-full my-1 object-cover border border-border"
                    />
                  </TableCell>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell className="text-muted-foreground">{user.email}</TableCell>
                  <TableCell>{new Date(user.createdAt).toLocaleString()}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end items-center gap-2">
                      <Button
                        variant={'outline'}
                        size={'icon'}
                        onClick={() => handleEditClick(user)}
                      >
                        <IconPencil size={16} />
                      </Button>
                      <Button variant={'destructive'} size={'icon'}>
                        <IconTrash size={16} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            {getAllUsers && getAllUsers.filter((user) => user.role === 'admin').length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  No administrators found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Table 2: All Users */}
      <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
        <div className="p-4 border-b border-border bg-muted/40">
          <h2 className="font-semibold text-lg flex items-center gap-2">
            <IconUser className="text-indigo-500 w-5 h-5" />
            All Users
          </h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px]" />
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Join Date</TableHead>
              <TableHead className="w-[120px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {getAllUsers?.map((user) => (
              <TableRow key={user._id} className="hover:bg-muted/30 transition-colors">
                <TableCell>
                  <Image
                    src={user.imageUrl}
                    alt={user.name}
                    width={40}
                    height={40}
                    className="rounded-full my-1 object-cover border border-border"
                  />
                </TableCell>
                <TableCell className="font-medium">{user.name}</TableCell>
                <TableCell className="text-muted-foreground">{user.email}</TableCell>
                <TableCell>
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                      user.role === 'admin'
                        ? 'bg-amber-500/10 text-amber-600 border-amber-500/25 dark:text-amber-400'
                        : 'bg-slate-500/10 text-slate-600 border-slate-500/25 dark:text-slate-400'
                    }`}
                  >
                    {user.role === 'admin' && <IconCrown className="w-3 h-3" />}
                    {user.role}
                  </span>
                </TableCell>
                <TableCell>{new Date(user.createdAt).toLocaleString()}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end items-center gap-2">
                    <Button variant={'outline'} size={'icon'} onClick={() => handleEditClick(user)}>
                      <IconPencil size={16} />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {getAllUsers && getAllUsers.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No users found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Edit User Dialog */}
      <Dialog
        open={isOpen}
        onOpenChange={(open) => {
          if (!open) handleDiscard();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit User Profile</DialogTitle>
            <DialogDescription>
              Edit name, email address, and roles for this account.
            </DialogDescription>
          </DialogHeader>

          {editingUser && (
            <form onSubmit={handleSave} className="space-y-4 py-2">
              <div className="flex justify-center pb-2">
                <Image
                  src={editingUser.imageUrl}
                  alt={editName}
                  width={64}
                  height={64}
                  className="rounded-full ring-4 ring-primary/10 object-cover border border-border"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                  className="rounded-lg"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  required
                  className="rounded-lg"
                />
              </div>

              <div className="space-y-2">
                <Label>Role</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setEditRole('admin')}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all duration-200 cursor-pointer ${
                      editRole === 'admin'
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-border hover:border-muted-foreground/30 text-muted-foreground bg-transparent hover:text-foreground'
                    }`}
                  >
                    <IconCrown
                      className={`w-5 h-5 mb-1 ${editRole === 'admin' ? 'text-primary' : 'text-muted-foreground'}`}
                    />
                    <span className="text-sm font-semibold">Admin</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditRole('user')}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all duration-200 cursor-pointer ${
                      editRole === 'user'
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-border hover:border-muted-foreground/30 text-muted-foreground bg-transparent hover:text-foreground'
                    }`}
                  >
                    <IconUser
                      className={`w-5 h-5 mb-1 ${editRole === 'user' ? 'text-primary' : 'text-muted-foreground'}`}
                    />
                    <span className="text-sm font-semibold">User</span>
                  </button>
                </div>
              </div>

              <DialogFooter className="pt-4 border-t border-border flex gap-2 justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleDiscard}
                  disabled={isSubmitting}
                  className="rounded-xl cursor-pointer"
                >
                  Discard
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-medium cursor-pointer"
                >
                  {isSubmitting ? 'Saving...' : 'Save changes'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
