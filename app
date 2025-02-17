import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Select, SelectItem } from "@/components/ui/select";

export default function CoconutFlowerTracker() {
  const [shops, setShops] = useState([]);
  const [inventory, setInventory] = useState(150);
  const [newShop, setNewShop] = useState("");
  const [transactions, setTransactions] = useState([]);
  const [selectedShop, setSelectedShop] = useState(null);
  const [numFlowers, setNumFlowers] = useState("");
  const [rate, setRate] = useState("");
  const [cashReceived, setCashReceived] = useState("");

  const addShop = () => {
    if (newShop.trim()) {
      setShops([...shops, { name: newShop, balance: 0, purchaseHistory: [] }]);
      setNewShop("");
    }
  };

  const recordSale = () => {
    if (!selectedShop || !numFlowers || !rate) return;
    const shopIndex = shops.findIndex(shop => shop.name === selectedShop);
    if (shopIndex === -1) return;

    const amount = parseInt(numFlowers) * parseFloat(rate);
    const received = parseFloat(cashReceived) || 0;
    const newBalance = shops[shopIndex].balance + amount - received;

    const updatedShops = [...shops];
    updatedShops[shopIndex].balance = newBalance;
    updatedShops[shopIndex].purchaseHistory.push({ numFlowers, rate, amount, received, date: new Date().toLocaleDateString() });
    
    setShops(updatedShops);
    setTransactions([...transactions, { shop: selectedShop, numFlowers, rate, amount, received, date: new Date().toLocaleDateString() }]);
    setInventory(inventory - parseInt(numFlowers));
    setNumFlowers("");
    setRate("");
    setCashReceived("");
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Coconut Flower Tracker</h1>
      <Card className="mb-4">
        <CardContent>
          <p>Available Inventory: {inventory} Coconut Flowers</p>
        </CardContent>
      </Card>
      
      <div className="flex gap-2 mb-4">
        <Input value={newShop} onChange={(e) => setNewShop(e.target.value)} placeholder="New Shop Name" />
        <Button onClick={addShop}>Add Shop</Button>
      </div>
      
      <div className="mb-4">
        <Select onValueChange={setSelectedShop}>
          {shops.map((shop, index) => (
            <SelectItem key={index} value={shop.name}>{shop.name} (Balance: ₹{shop.balance})</SelectItem>
          ))}
        </Select>
      </div>

      <div className="flex gap-2 mb-4">
        <Input type="number" value={numFlowers} onChange={(e) => setNumFlowers(e.target.value)} placeholder="Number of Flowers" />
        <Input type="number" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="Rate per Flower" />
        <p>Total: ₹{numFlowers && rate ? numFlowers * rate : 0}</p>
      </div>

      <div className="flex gap-2 mb-4">
        <Input type="number" value={cashReceived} onChange={(e) => setCashReceived(e.target.value)} placeholder="Cash Received" />
        <Button onClick={recordSale}>Record Sale</Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Shop</TableHead>
            <TableHead>Balance</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {shops.map((shop, index) => (
            <TableRow key={index}>
              <TableCell>{shop.name}</TableCell>
              <TableCell>₹{shop.balance}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
