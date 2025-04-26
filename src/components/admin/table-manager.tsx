
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
  getCurrentTables, // Use getCurrentTables to get the initial state
  addMockTable,
  updateMockTable,
  deleteMockTable,
  getIconComponent, // Import helper function
  getIconNameFromComponent // To get name from component for editing
} from '@/lib/data'; // Adjust import path if needed
import type { GameTable, GameTableInput } from '@/lib/types';
import { Pencil, Trash2, PlusCircle, Swords, Castle, Flag } from 'lucide-react'; // Import icons

// Map icon names to components for the Select dropdown
const iconMap: Record<string, React.ElementType> = {
  Swords: Swords,
  Castle: Castle,
  Flag: Flag,
};
const defaultIconName = 'Swords'; // Define default icon name

export default function TableManager() {
  // Important: In a real app, fetch/mutate data via API calls to a backend.
  // This component directly manipulates the mock data for demonstration.
  const [tables, setTables] = useState<GameTable[]>([]); // Initialize empty, fetch in useEffect
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<GameTable | null>(null);
  const [formData, setFormData] = useState<GameTableInput>({
    gameName: '',
    day: 'Thursday',
    timeSlot: '',
    totalSeats: 0,
    gameTypeIconName: defaultIconName, // Default icon name
  });
  const { toast } = useToast();

  // Fetch initial data on component mount
  useEffect(() => {
    setTables(getCurrentTables());
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
    const iconName = getIconNameFromComponent(table.gameTypeIcon) || defaultIconName; // Find icon name or use default
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
    // Consider adding a confirmation dialog here in a real app
    try {
        deleteMockTable(tableId); // Mutate mock data
        setTables(getCurrentTables()); // Refresh local state from the source
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
      totalSeats: 4, // Sensible default
      gameTypeIconName: defaultIconName,
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
            // Update existing table - Pass ID along with form data
            updateMockTable({ ...formData, id: editingTable.id });
            toast({ title: "Table Updated", description: "Game table details saved." });
        } else {
            // Add new table
            addMockTable(formData);
            toast({ title: "Table Added", description: "New game table created successfully." });
        }
        setTables(getCurrentTables()); // Refresh local state from the source
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
                    {/* Use Select for predefined slots or keep Input for flexibility */}
                     <Select name="timeSlot" value={formData.timeSlot} onValueChange={handleSelectChange('timeSlot')} required>
                         <SelectTrigger className="col-span-3">
                             <SelectValue placeholder="Select Time Slot" />
                         </SelectTrigger>
                         <SelectContent>
                             <SelectItem value="09:00 - 13:00">AM (09:00 - 13:00)</SelectItem>
                             <SelectItem value="14:00 - 19:00">PM (14:00 - 19:00)</SelectItem>
                             {/* Add other common slots if needed */}
                         </SelectContent>
                     </Select>
                    {/* <Input id="timeSlot" name="timeSlot" value={formData.timeSlot} onChange={handleInputChange} placeholder="e.g., 09:00 - 13:00" className="col-span-3" required /> */}
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
                const timeOrder = ["09:00 - 13:00", "14:00 - 19:00"]; // AM then PM
                if (a.gameName !== b.gameName) return a.gameName.localeCompare(b.gameName);
                if (a.day !== b.day) return dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day);
                return timeOrder.indexOf(a.timeSlot) - timeOrder.indexOf(b.timeSlot);
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
