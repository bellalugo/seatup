'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import {
  mockGameTables as initialTables,
  addMockTable,
  updateMockTable,
  deleteMockTable,
  getIconComponent // Import helper function
} from '@/lib/data'; // Adjust import path if needed
import type { GameTable, GameTableInput } from '@/lib/types';
import { Pencil, Trash2, PlusCircle, Swords, Castle, Flag } from 'lucide-react'; // Import icons

// Map icon names to components for the Select dropdown
const iconMap: Record<string, React.ElementType> = {
  Swords: Swords,
  Castle: Castle,
  Flag: Flag,
};

export default function TableManager() {
  // Important: In a real app, fetch/mutate data via API calls to a backend.
  // This component directly manipulates the mock data for demonstration.
  const [tables, setTables] = useState<GameTable[]>(initialTables);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<GameTable | null>(null);
  const [formData, setFormData] = useState<GameTableInput>({
    gameName: '',
    day: 'Thursday',
    timeSlot: '',
    totalSeats: 0,
    gameTypeIconName: 'Swords', // Default icon name
  });
  const { toast } = useToast();

  // Effect to potentially refresh data if needed, but not critical for mock data
   useEffect(() => {
    // If this were fetching from an API, you might refetch here.
    // setTables(initialTables); // Resetting based on import might be needed if edits happen elsewhere
  }, []);


  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseInt(value, 10) || 0 : value,
    }));
  };

  const handleSelectChange = (name: keyof GameTableInput) => (value: string) => {
     setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleEdit = (table: GameTable) => {
    setEditingTable(table);
    const iconName = Object.keys(iconMap).find(key => iconMap[key] === table.gameTypeIcon) || 'Swords'; // Find icon name
    setFormData({
        gameName: table.gameName,
        day: table.day,
        timeSlot: table.timeSlot,
        totalSeats: table.totalSeats,
        gameTypeIconName: iconName
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (tableId: string) => {
    // Add confirmation dialog here in a real app
    try {
        deleteMockTable(tableId); // Mutate mock data
        setTables(prev => prev.filter(t => t.id !== tableId)); // Update local state
        toast({ title: "Table Deleted", description: "The game table has been removed." });
    } catch (error) {
         toast({ variant: "destructive", title: "Error Deleting Table", description: (error as Error).message });
    }
  };

  const handleOpenDialogForAdd = () => {
    setEditingTable(null);
    setFormData({ // Reset form for adding
      gameName: '',
      day: 'Thursday',
      timeSlot: '',
      totalSeats: 0,
      gameTypeIconName: 'Swords',
    });
    setIsDialogOpen(true);
  };

   const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Basic validation (add more robust validation as needed)
    if (!formData.gameName || !formData.timeSlot || formData.totalSeats <= 0) {
        toast({ variant: "destructive", title: "Invalid Input", description: "Please fill all fields correctly." });
        return;
    }

    try {
        if (editingTable) {
        // Update existing table
        const updatedTableData = updateMockTable({
            ...editingTable, // Keep the original ID
            ...formData,
             gameTypeIcon: getIconComponent(formData.gameTypeIconName), // Convert name back to component
        });
        setTables(prev => prev.map(t => (t.id === editingTable.id ? updatedTableData : t)));
        toast({ title: "Table Updated", description: "Game table details saved." });
        } else {
        // Add new table
         const newTableData = addMockTable(formData);
         setTables(prev => [...prev, newTableData]);
         toast({ title: "Table Added", description: "New game table created successfully." });
        }
        setIsDialogOpen(false); // Close dialog on success
    } catch(error) {
         toast({ variant: "destructive", title: "Operation Failed", description: (error as Error).message });
    }

  };


  return (
    <Card className="shadow-lg">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Manage Game Tables</CardTitle>
          <CardDescription>Add, edit, or delete game tables for the convention.</CardDescription>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleOpenDialogForAdd}>
              <PlusCircle className="mr-2 h-4 w-4" /> Add Table
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>{editingTable ? 'Edit Game Table' : 'Add New Game Table'}</DialogTitle>
              <DialogDescription>
                {editingTable ? 'Modify the details of the existing table.' : 'Enter the details for the new game table.'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="grid gap-4 py-4">
                 {/* Form Fields */}
                 <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="gameName" className="text-right">Game Name</Label>
                    <Input id="gameName" name="gameName" value={formData.gameName} onChange={handleInputChange} className="col-span-3" required />
                 </div>
                 <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="day" className="text-right">Day</Label>
                     <Select name="day" value={formData.day} onValueChange={handleSelectChange('day')} required>
                        <SelectTrigger className="col-span-3">
                            <SelectValue placeholder="Select Day" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Thursday">Thursday</SelectItem>
                            <SelectItem value="Friday">Friday</SelectItem>
                            <SelectItem value="Saturday">Saturday</SelectItem>
                            <SelectItem value="Sunday">Sunday</SelectItem>
                        </SelectContent>
                    </Select>
                 </div>
                 <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="timeSlot" className="text-right">Time Slot</Label>
                    <Input id="timeSlot" name="timeSlot" value={formData.timeSlot} onChange={handleInputChange} placeholder="e.g., 09:00 - 13:00" className="col-span-3" required />
                 </div>
                 <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="totalSeats" className="text-right">Total Seats</Label>
                    <Input id="totalSeats" name="totalSeats" type="number" value={formData.totalSeats} onChange={handleInputChange} className="col-span-3" min="1" required />
                 </div>
                 <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="gameTypeIconName" className="text-right">Icon</Label>
                     <Select name="gameTypeIconName" value={formData.gameTypeIconName} onValueChange={handleSelectChange('gameTypeIconName')} required>
                        <SelectTrigger className="col-span-3">
                            <SelectValue placeholder="Select Icon" />
                        </SelectTrigger>
                        <SelectContent>
                            {Object.keys(iconMap).map(iconName => (
                                <SelectItem key={iconName} value={iconName}>
                                    <div className="flex items-center gap-2">
                                        {React.createElement(iconMap[iconName], { className: "h-4 w-4" })}
                                        {iconName}
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                 </div>
              </div>
              <DialogFooter>
                 <DialogClose asChild>
                    <Button type="button" variant="outline">Cancel</Button>
                 </DialogClose>
                <Button type="submit">{editingTable ? 'Save Changes' : 'Add Table'}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableCaption>A list of configured game tables.</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Icon</TableHead>
              <TableHead>Game Name</TableHead>
              <TableHead>Day</TableHead>
              <TableHead>Time Slot</TableHead>
              <TableHead className="text-center">Seats</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tables.sort((a, b) => { // Sort for consistent display
                const dayOrder = ['Thursday', 'Friday', 'Saturday', 'Sunday'];
                if (a.day !== b.day) return dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day);
                return a.timeSlot.localeCompare(b.timeSlot);
            }).map((table) => (
              <TableRow key={table.id}>
                 <TableCell>
                    {table.gameTypeIcon && React.createElement(table.gameTypeIcon, { className: "h-5 w-5 text-muted-foreground" })}
                 </TableCell>
                <TableCell className="font-medium">{table.gameName}</TableCell>
                <TableCell>{table.day}</TableCell>
                <TableCell>{table.timeSlot}</TableCell>
                <TableCell className="text-center">{table.totalSeats}</TableCell>
                <TableCell className="text-right space-x-2">
                  <Button variant="outline" size="icon" onClick={() => handleEdit(table)}>
                    <Pencil className="h-4 w-4" />
                    <span className="sr-only">Edit</span>
                  </Button>
                  <Button variant="destructive" size="icon" onClick={() => handleDelete(table.id)}>
                    <Trash2 className="h-4 w-4" />
                     <span className="sr-only">Delete</span>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}