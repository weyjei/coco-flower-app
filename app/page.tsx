"use client"

import { useState, useEffect, useMemo } from "react"
import { Flower, MapPin, Edit, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts"
import * as XLSX from "xlsx"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { CalendarIcon } from "lucide-react"
import { sql } from '@vercel/postgres';

interface Shop {
  id: string
  name: string
  owner: string
  phone: string
  alternateNumbers: { name: string; number: string }[]
  address: string
  location?: string
}

interface Transaction {
  id: string
  shopId: string
  flowersSold: number
  rate: number
  cashReceived: number
  date: string
  replacedFlowers?: number
  outstandingBalance: number
}

interface FarmMovement {
  id: string
  flowersAdded: number
  date: string
  type: "godown" | "available"
}

interface StockMovement {
  id: string;
  type: 'godown' | 'available';
  quantity: number;
  date: string;
}

export default function CoconutFlowerManagement() {
  const [shops, setShops] = useState<Shop[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [farmMovements, setFarmMovements] = useState<FarmMovement[]>([])
  const [availableStock, setAvailableStock] = useState(0)
  const [godownStock, setGodownStock] = useState(0)
  const [newShop, setNewShop] = useState<Omit<Shop, "id">>({
    name: "",
    owner: "",
    phone: "",
    alternateNumbers: [],
    address: "",
    location: "",
  })
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null)
  const [flowersSold, setFlowersSold] = useState("")
  const [rate, setRate] = useState("")
  const [cashReceived, setCashReceived] = useState("")
  const [replacedFlowers, setReplacedFlowers] = useState("")
  const [flowersFromFarm, setFlowersFromFarm] = useState("")
  const [selectedShopForHistory, setSelectedShopForHistory] = useState<Shop | null>(null)
  const [saleDate, setSaleDate] = useState<Date>(new Date())
  const [shopSearch, setShopSearch] = useState("")
  const [editingShop, setEditingShop] = useState<Shop | null>(null)
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date())
  const [showReceiptDialog, setShowReceiptDialog] = useState(false)
  const [historyFilter, setHistoryFilter] = useState({
    shop: "",
    minRate: "",
    maxRate: "",
    minOutstanding: "",
    maxOutstanding: "",
  })
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "ascending" | "descending" } | null>(null)
  const [showAddShopDialog, setShowAddShopDialog] = useState(false)
  const [farmMovementDate, setFarmMovementDate] = useState<Date>(new Date())
  const [farmMovementType, setFarmMovementType] = useState<"godown" | "available">("godown")
  const [trendChartPeriod, setTrendChartPeriod] = useState<"month" | "7days" | "30days" | "all">("month")
  const [historyStartDate, setHistoryStartDate] = useState<Date | undefined>(undefined)
  const [historyEndDate, setHistoryEndDate] = useState<Date | undefined>(undefined)
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([])
  const [stockStartDate, setStockStartDate] = useState<Date | undefined>(undefined)
  const [stockEndDate, setStockEndDate] = useState<Date | undefined>(undefined)
  const [transactionStartDate, setTransactionStartDate] = useState<Date | undefined>(undefined)
  const [transactionEndDate, setTransactionEndDate] = useState<Date | undefined>(undefined)

  useEffect(() => {
    const loadData = async () => {
      try {
        const { rows: data } = await sql`
          SELECT * FROM app_data WHERE id = 'main_data'
        `;
        
        if (data.length > 0) {
          const savedData = JSON.parse(data[0].data);
          setShops(savedData.shops || []);
          setTransactions(savedData.transactions || []);
          setFarmMovements(savedData.farmMovements || []);
          setAvailableStock(savedData.availableStock || 0);
          setGodownStock(savedData.godownStock || 0);
        }
      } catch (error) {
        // If table doesn't exist, create it
        await sql`
          CREATE TABLE IF NOT EXISTS app_data (
            id TEXT PRIMARY KEY,
            data JSONB
          )
        `;
      }
    };

    loadData();
    const interval = setInterval(loadData, 5000); // Poll every 5 seconds
    
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const saveData = async () => {
      const data = {
        shops,
        transactions,
        farmMovements,
        availableStock,
        godownStock
      };

      await sql`
        INSERT INTO app_data (id, data)
        VALUES ('main_data', ${JSON.stringify(data)})
        ON CONFLICT (id) DO UPDATE SET data = ${JSON.stringify(data)}
      `;
    };

    saveData();
  }, [shops, transactions, farmMovements, availableStock, godownStock]);

  const addShop = () => {
    if (newShop.name.trim() && newShop.owner.trim() && newShop.phone.trim() && newShop.address.trim()) {
      const shopToAdd: Shop = {
        id: Date.now().toString(),
        ...newShop,
      }
      setShops([...shops, shopToAdd])
      setNewShop({ name: "", owner: "", phone: "", alternateNumbers: [], address: "", location: "" })
      setShowAddShopDialog(false)
    }
  }

  const updateShop = () => {
    if (editingShop) {
      setShops(shops.map((shop) => (shop.id === editingShop.id ? editingShop : shop)))
      setEditingShop(null)
    }
  }

  const recordSale = () => {
    if (selectedShop && flowersSold && rate && cashReceived) {
      const flowersSoldNum = Number.parseInt(flowersSold)
      const rateNum = Number.parseFloat(rate)
      const cashReceivedNum = Number.parseFloat(cashReceived)
      const replacedFlowersNum = replacedFlowers ? Number.parseInt(replacedFlowers) : 0

      if (flowersSoldNum > availableStock) {
        alert("Not enough flowers in stock!")
        return
      }

      const previousOutstanding = getShopBalance(selectedShop.id)
      const newOutstanding = previousOutstanding + flowersSoldNum * rateNum - cashReceivedNum

      const newTransaction: Transaction = {
        id: Date.now().toString(),
        shopId: selectedShop.id,
        flowersSold: flowersSoldNum,
        rate: rateNum,
        cashReceived: cashReceivedNum,
        date: saleDate.toISOString(),
        replacedFlowers: replacedFlowersNum,
        outstandingBalance: newOutstanding,
      }

      setTransactions(
        [...transactions, newTransaction].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
      )
      setAvailableStock(availableStock - flowersSoldNum + replacedFlowersNum)
      setShowReceiptDialog(true)
    }
  }

  const addFlowersFromFarm = () => {
    if (flowersFromFarm) {
      const flowersAdded = Number.parseInt(flowersFromFarm)
      const movement: StockMovement = {
        id: Date.now().toString(),
        type: farmMovementType,
        quantity: flowersAdded,
        date: farmMovementDate.toISOString()
      }

      const updatedMovements = [...stockMovements, movement].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      )
      setStockMovements(updatedMovements)
      
      if (farmMovementType === 'available') {
        setAvailableStock(availableStock + flowersAdded)
        setGodownStock(godownStock - flowersAdded)
      } else {
        setGodownStock(godownStock + flowersAdded)
      }
      setFlowersFromFarm("")
    }
  }

  const getShopBalance = (shopId: string) => {
    const shopTransactions = transactions
      .filter((t) => t.shopId === shopId)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    return shopTransactions.length > 0 ? shopTransactions[shopTransactions.length - 1].outstandingBalance : 0
  }

  const getTotalOutstanding = () => {
    return shops.reduce((total, shop) => total + getShopBalance(shop.id), 0)
  }

  const getShopsWithOutstanding = () => {
    return shops
      .filter((shop) => getShopBalance(shop.id) > 0)
      .sort((a, b) => getShopBalance(b.id) - getShopBalance(a.id))
  }

  const getShopTransactions = (shopId: string) => {
    return transactions
      .filter((t) => t.shopId === shopId)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  }

  const getLastSaleRate = (shopId: string) => {
    const shopTransactions = getShopTransactions(shopId)
    if (shopTransactions.length > 0) {
      return shopTransactions[shopTransactions.length - 1].rate
    }
    return null
  }

  const getLastDeliveryDetails = (shopId: string) => {
    const shopTransactions = getShopTransactions(shopId)
    if (shopTransactions.length > 0) {
      const lastTransaction = shopTransactions[shopTransactions.length - 1]
      return {
        date: new Date(lastTransaction.date).toLocaleDateString(),
        flowersSold: lastTransaction.flowersSold,
        rate: lastTransaction.rate,
      }
    }
    return null
  }

  const getSummary = (period: "day" | "week" | "month", shopId?: string) => {
    const now = new Date()
    const periodStart = new Date(now)
    switch (period) {
      case "day":
        periodStart.setDate(now.getDate() - 1)
        break
      case "week":
        periodStart.setDate(now.getDate() - 7)
        break
      case "month":
        periodStart.setMonth(now.getMonth() - 1)
        break
    }

    const filteredTransactions = transactions.filter(
      (t) => (!shopId || t.shopId === shopId) && new Date(t.date) >= periodStart,
    )

    const totalSold = filteredTransactions.reduce((sum, t) => sum + t.flowersSold, 0)
    const totalAmount = filteredTransactions.reduce((sum, t) => sum + t.flowersSold * t.rate, 0)
    const totalReceived = filteredTransactions.reduce((sum, t) => sum + t.cashReceived, 0)
    const totalReplaced = filteredTransactions.reduce((sum, t) => sum + (t.replacedFlowers || 0), 0)

    const averagePrice = totalSold > 0 ? totalAmount / (totalSold + totalReplaced) : 0

    return {
      totalSold,
      totalAmount,
      totalReceived,
      balance: totalAmount - totalReceived,
      averagePrice,
    }
  }

  const handleFlowerSoldChange = (value: number) => {
    setFlowersSold((prevValue) => {
      const currentValue = Number.parseInt(prevValue) || 0
      return (currentValue + value).toString()
    })
  }

  const handleRateChange = (value: number) => {
    setRate(value.toString())
  }

  const filteredShops = shops
    .filter((shop) => shop.name.toLowerCase().includes(shopSearch.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name))

  const generateReceipt = () => {
    if (!selectedShop) return;

    const shopTransactions = getShopTransactions(selectedShop.id)
      .filter(t => new Date(t.date) < saleDate)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const lastDelivery = shopTransactions.length > 0 ? shopTransactions[0] : null;
    const previousBalance = shopTransactions.length > 0 ? 
      shopTransactions[0].outstandingBalance : 0;

    const newBalance = previousBalance + 
      (Number.parseInt(flowersSold) * Number.parseFloat(rate)) - 
      Number.parseFloat(cashReceived);

    const receiptContent = `
Coconut Flower
Phone: 9943676453
------------------------
Shop: ${selectedShop.name}
Date: ${saleDate.toLocaleDateString()}
${lastDelivery ? `Last Delivery: ${new Date(lastDelivery.date).toLocaleDateString()} - ${lastDelivery.flowersSold} flowers at ₹${lastDelivery.rate}` : ''}
Flowers Sold: ${flowersSold}
Rate: ₹${rate}
Total Amount: ₹${(Number.parseInt(flowersSold) * Number.parseFloat(rate)).toFixed(2)}
Cash Received: ₹${cashReceived}
${shopTransactions.length > 0 ? `Previous Balance: ₹${previousBalance.toFixed(2)}` : ''}
New Balance: ₹${newBalance.toFixed(2)}
------------------------
Thank you for your business!
    `;

    // Add copy to clipboard button
    const textArea = document.createElement('textarea');
    textArea.value = receiptContent;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);

    // Also provide download option
    const blob = new Blob([receiptContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `receipt_${selectedShop.name}_${saleDate.toISOString().split('T')[0]}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const updateTransaction = () => {
    if (editingTransaction) {
      const updatedTransactions = [...transactions]
      
      // Remove the editing transaction first
      const withoutEditing = updatedTransactions.filter(t => t.id !== editingTransaction.id)
      
      // Add back the edited transaction
      withoutEditing.push(editingTransaction)
      
      // Sort all transactions by date
      const sortedTransactions = withoutEditing.sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      )

      // Recalculate all balances by shop
      const shopGroups = groupBy(sortedTransactions, 'shopId')
      
      const recalculatedTransactions = sortedTransactions.map(t => {
        const shopTransactions = shopGroups[t.shopId]
          .filter(st => new Date(st.date) <= new Date(t.date))
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        
        const balance = shopTransactions.reduce((sum, curr) => 
          sum + (curr.flowersSold * curr.rate - curr.cashReceived), 0)
        
        return {
          ...t,
          outstandingBalance: balance
        }
      })

      setTransactions(recalculatedTransactions)
      setEditingTransaction(null)
    }
  }

  const groupBy = (array: any[], key: string) => {
    return array.reduce((result, currentValue) => {
      (result[currentValue[key]] = result[currentValue[key]] || []).push(currentValue)
      return result
    }, {})
  }

  const getShopDeliveryTrends = (shopId: string) => {
    const shopTransactions = getShopTransactions(shopId)
    let startDate: Date
    const endDate = new Date()

    switch (trendChartPeriod) {
      case "month":
        startDate = new Date(endDate)
        startDate.setMonth(endDate.getMonth() - 1)
        break
      case "7days":
        startDate = new Date(endDate)
        startDate.setDate(endDate.getDate() - 7)
        break
      case "30days":
        startDate = new Date(endDate)
        startDate.setDate(endDate.getDate() - 30)
        break
      case "all":
      default:
        startDate = new Date(0)
    }

    const filteredTransactions = shopTransactions
      .filter((t) => new Date(t.date) >= startDate && new Date(t.date) <= endDate)
      
    let cumulative = 0
    return filteredTransactions.map((t) => {
      cumulative += t.flowersSold
      return {
        date: new Date(t.date).toLocaleDateString(),
        flowersSold: t.flowersSold,
        cumulativeQuantity: cumulative,
        amount: t.flowersSold * t.rate
      }
    })
  }

  const sortedTransactions = useMemo(() => {
    const sortedData = [...transactions]
    if (sortConfig !== null) {
      sortedData.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) {
          return sortConfig.direction === "ascending" ? -1 : 1
        }
        if (a[sortConfig.key] > b[sortConfig.key]) {
          return sortConfig.direction === "ascending" ? 1 : -1
        }
        return 0
      })
    }
    return sortedData
  }, [transactions, sortConfig])

  const requestSort = (key: string) => {
    let direction: "ascending" | "descending" = "ascending"
    if (sortConfig && sortConfig.key === key && sortConfig.direction === "ascending") {
      direction = "descending"
    }
    setSortConfig({ key, direction })
  }

  const generateReceiptForTransaction = (transaction: Transaction) => {
    const shop = shops.find(s => s.id === transaction.shopId)
    if (!shop) return

    const shopTransactions = getShopTransactions(shop.id)
      .filter(t => new Date(t.date) < new Date(transaction.date))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    const lastDelivery = shopTransactions.length > 0 ? shopTransactions[0] : null
    const previousBalance = shopTransactions.length > 0 ? 
      shopTransactions[0].outstandingBalance : 0

    const receiptContent = `
Coconut Flower
Phone: 9943676453
------------------------
Shop: ${shop.name}
Date: ${new Date(transaction.date).toLocaleDateString()}
${lastDelivery ? `Last Delivery: ${new Date(lastDelivery.date).toLocaleDateString()} - ${lastDelivery.flowersSold} flowers at ₹${lastDelivery.rate}` : ''}
Flowers Sold: ${transaction.flowersSold}
Rate: ₹${transaction.rate}
Total Amount: ₹${(transaction.flowersSold * transaction.rate).toFixed(2)}
Cash Received: ₹${transaction.cashReceived}
${shopTransactions.length > 0 ? `Previous Balance: ₹${previousBalance.toFixed(2)}` : ''}
New Balance: ₹${transaction.outstandingBalance.toFixed(2)}
------------------------
Thank you for your business!
    `

    // Copy to clipboard
    const textArea = document.createElement('textarea')
    textArea.value = receiptContent
    document.body.appendChild(textArea)
    textArea.select()
    document.execCommand('copy')
    document.body.removeChild(textArea)

    // Download
    const blob = new Blob([receiptContent], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `receipt_${shop.name}_${transaction.date.split('T')[0]}.txt`
    link.click()
    URL.revokeObjectURL(url)
  }

  const getFilteredTransactions = (transactions: Transaction[], period: string, dateRange?: { from: Date | undefined; to: Date | undefined }) => {
    if (dateRange?.from || dateRange?.to) {
      return transactions.filter(t => {
        const transactionDate = new Date(t.date)
        return (!dateRange.from || transactionDate >= dateRange.from) &&
               (!dateRange.to || transactionDate <= dateRange.to)
      })
    }

    const endDate = new Date()
    let startDate = new Date()

    switch (period) {
      case "7days":
        startDate.setDate(endDate.getDate() - 7)
        break
      case "30days":
        startDate.setDate(endDate.getDate() - 30)
        break
      case "month":
        startDate.setMonth(endDate.getMonth() - 1)
        break
      case "all":
        return transactions
    }

    return transactions.filter(t => {
      const transactionDate = new Date(t.date)
      return transactionDate >= startDate && transactionDate <= endDate
    })
  }

  const getFilteredAndSortedTransactions = (
    transactions: Transaction[], 
    date?: Date,
    startDate?: Date,
    endDate?: Date,
    shopId?: string
  ) => {
    return transactions
      .filter(t => {
        const transactionDate = new Date(t.date)
        const matchesDate = !date || transactionDate.toDateString() === date.toDateString()
        const matchesDateRange = (!startDate || transactionDate >= startDate) && 
                               (!endDate || transactionDate <= endDate)
        const matchesShop = !shopId || t.shopId === shopId
        
        return matchesDate && matchesDateRange && matchesShop
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  }

  const getTransactionSummary = (transactions: Transaction[]) => {
    return {
      totalFlowers: transactions.reduce((sum, t) => sum + t.flowersSold, 0),
      totalAmount: transactions.reduce((sum, t) => sum + (t.flowersSold * t.rate), 0),
      totalReceived: transactions.reduce((sum, t) => sum + t.cashReceived, 0),
      averageRate: transactions.length > 0 
        ? transactions.reduce((sum, t) => sum + t.rate, 0) / transactions.length 
        : 0,
      totalOutstanding: transactions.length > 0 
        ? transactions[transactions.length - 1].outstandingBalance 
        : 0
    }
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">CocoFlower</h1>

      <Tabs defaultValue="dashboard" className="space-y-4">
        <TabsList className="flex justify-start overflow-x-auto">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="sales">Record Sale</TabsTrigger>
          <TabsTrigger value="stock">Stock</TabsTrigger>
          <TabsTrigger value="shops">Shops</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <div className="grid gap-4">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex flex-col gap-1">
                    <p className="text-sm font-medium text-muted-foreground">Stock in Hand</p>
                    <div className="flex items-center gap-2">
                      <Flower className="h-4 w-4 text-primary" />
                      <h2 className="text-2xl font-bold">{availableStock}</h2>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex flex-col gap-1">
                    <p className="text-sm font-medium text-muted-foreground">Total Stock in Godown</p>
                    <div className="flex items-center gap-2">
                      <Flower className="h-4 w-4 text-primary" />
                      <h2 className="text-2xl font-bold">{godownStock}</h2>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex flex-col gap-1">
                    <p className="text-sm font-medium text-muted-foreground">Total Outstanding</p>
                    <div className="flex items-center gap-2">
                      <span className="text-primary">₹</span>
                      <h2 className="text-2xl font-bold">{getTotalOutstanding().toFixed(2)}</h2>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex flex-col gap-1">
                    <p className="text-sm font-medium text-muted-foreground">Today's Sales</p>
                    <div className="flex items-center gap-2">
                      <Flower className="h-4 w-4 text-primary" />
                      <h2 className="text-2xl font-bold">
                        {transactions
                          .filter(t => new Date(t.date).toDateString() === new Date().toDateString())
                          .reduce((sum, t) => sum + t.flowersSold, 0)}
                      </h2>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Shops with Outstanding */}
            <Card>
              <CardHeader>
                <CardTitle>Shops with Outstanding Balance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Shop</TableHead>
                        <TableHead>Outstanding (₹)</TableHead>
                        <TableHead>Last Transaction</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {getShopsWithOutstanding().map((shop) => {
                        const lastTransaction = transactions
                          .filter(t => t.shopId === shop.id)
                          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
                        return (
                          <TableRow key={shop.id}>
                            <TableCell className="font-medium">{shop.name}</TableCell>
                            <TableCell>₹{getShopBalance(shop.id).toFixed(2)}</TableCell>
                            <TableCell>{lastTransaction ? new Date(lastTransaction.date).toLocaleDateString() : '-'}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Period Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {["day", "week", "month"].map((period) => {
                const summary = getSummary(period as "day" | "week" | "month")
                return (
                  <Card key={period}>
                    <CardHeader>
                      <CardTitle className="capitalize">{period} Summary</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Total Sold:</span>
                          <span className="font-medium">{summary.totalSold}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Total Amount:</span>
                          <span className="font-medium">₹{summary.totalAmount.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Total Received:</span>
                          <span className="font-medium">₹{summary.totalReceived.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Average Price:</span>
                          <span className="font-medium">₹{summary.averagePrice.toFixed(2)}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="sales">
          <Card>
            <CardHeader>
              <CardTitle>Record Sale</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                <Button onClick={() => setShowAddShopDialog(true)}>Add New Shop</Button>
                <div className="grid w-full max-w-sm items-center gap-1.5">
                  <Label htmlFor="shopSelect">Select Shop</Label>
                  <Select
                    onValueChange={(value) => {
                      const shop = shops.find((s) => s.id === value)
                      setSelectedShop(shop || null)
                      const lastRate = getLastSaleRate(value)
                      if (lastRate) setRate(lastRate.toString())
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a shop" />
                    </SelectTrigger>
                    <SelectContent>
                      <Input
                        placeholder="Search shops..."
                        value={shopSearch}
                        onChange={(e) => setShopSearch(e.target.value)}
                        className="mb-2"
                      />
                      {filteredShops.map((shop) => (
                        <SelectItem key={shop.id} value={shop.id}>
                          {shop.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {selectedShop && (
                  <Card className="bg-gradient-to-r from-slate-50 to-slate-100">
                    <CardContent className="pt-6 relative">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2"
                        onClick={() => setEditingShop(selectedShop)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <div className="border-b pb-4 mb-4">
                        <h2 className="text-2xl font-bold text-left text-slate-800">{selectedShop.name}</h2>
                      </div>
                      <div className="grid gap-4 text-slate-600">
                        <div className="flex flex-col sm:flex-row sm:justify-between gap-2">
                          <div className="flex gap-2">
                            <span className="font-semibold min-w-[4rem]">Owner:</span>
                            <span>{selectedShop.owner}</span>
                          </div>
                          <div className="flex gap-2">
                            <span className="font-semibold">Phone:</span>
                            <span><a href={`tel:${selectedShop.phone}`}>{selectedShop.phone}</a></span>
                          </div>
                        </div>
                        {selectedShop.alternateNumbers.map((number, index) => (
                          <div key={index} className="flex gap-2">
                            <span className="font-semibold min-w-[4rem]">{number.name}:</span>
                            <span><a href={`tel:${number.number}`}>{number.number}</a></span>
                          </div>
                        ))}
                        <div className="flex gap-2">
                          <span className="font-semibold min-w-[4rem]">Address:</span>
                          <span>{selectedShop.address}</span>
                        </div>
                        {selectedShop.location && (
                          <div className="flex gap-2">
                            <Button
                              variant="link"
                              className="p-0 h-auto font-normal"
                              onClick={() =>
                                window.open(
                                  `https://www.google.com/maps/search/?api=1&query=${selectedShop.location}`,
                                  "_blank",
                                )
                              }
                            >
                              <MapPin className="mr-2 h-4 w-4" />
                              View Location
                            </Button>
                          </div>
                        )}
                        <div className="border-t pt-4 mt-2">
                          <div className="flex gap-2">
                            <span className="font-semibold min-w-[4rem]">Balance:</span>
                            <span>₹{getShopBalance(selectedShop.id).toFixed(2)}</span>
                          </div>
                          {getLastDeliveryDetails(selectedShop.id) && (
                            <div className="mt-2">
                              <div className="font-semibold mb-1">Last Delivery:</div>
                              <div className="grid gap-1 pl-4">
                                <div>Date: {getLastDeliveryDetails(selectedShop.id)?.date}</div>
                                <div>Flowers: {getLastDeliveryDetails(selectedShop.id)?.flowersSold}</div>
                                <div>Rate: ₹{getLastDeliveryDetails(selectedShop.id)?.rate}</div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
                <div className="grid w-full max-w-sm items-center gap-1.5">
                  <Label htmlFor="saleDate">Sale Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-[240px] justify-start text-left font-normal",
                          !saleDate && "text-muted-foreground"
                        )}
                      >
                        {saleDate ? (
                          format(saleDate, "PPP")
                        ) : (
                          <span>Pick a date</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={saleDate}
                        onSelect={(date) => date && setSaleDate(date)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="grid w-full max-w-sm items-center gap-1.5">
                  <Label htmlFor="flowersSold">Flowers Sold</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      id="flowersSold"
                      value={flowersSold}
                      onChange={(e) => setFlowersSold(e.target.value)}
                      placeholder="Number of flowers"
                    />
                    <Button onClick={() => handleFlowerSoldChange(5)}>+5</Button>
                    <Button onClick={() => handleFlowerSoldChange(10)}>+10</Button>
                  </div>
                </div>
                <div className="grid w-full max-w-sm items-center gap-1.5">
                  <Label htmlFor="rate">Rate per Flower (₹)</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      id="rate"
                      value={rate}
                      onChange={(e) => setRate(e.target.value)}
                      placeholder="Rate per flower"
                    />
                    <Button onClick={() => handleRateChange(40)}>₹40</Button>
                    <Button onClick={() => handleRateChange(45)}>₹45</Button>
                  </div>
                </div>
                {flowersSold && rate && (
                  <div>
                    <p>Total Amount: ₹{(Number.parseInt(flowersSold) * Number.parseFloat(rate)).toFixed(2)}</p>
                  </div>
                )}
                <div className="grid w-full max-w-sm items-center gap-1.5">
                  <Label htmlFor="cashReceived">Cash Received (₹)</Label>
                  <Input
                    type="number"
                    id="cashReceived"
                    value={cashReceived}
                    onChange={(e) => setCashReceived(e.target.value)}
                    placeholder="Cash received"
                  />
                </div>
                <div className="grid w-full max-w-sm items-center gap-1.5">
                  <Label htmlFor="replacedFlowers">Replaced Flowers</Label>
                  <Input
                    type="number"
                    id="replacedFlowers"
                    value={replacedFlowers}
                    onChange={(e) => setReplacedFlowers(e.target.value)}
                    placeholder="Number of replaced flowers"
                  />
                </div>
                <Button onClick={recordSale}>Record Sale</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stock">
          <Card>
            <CardHeader>
              <CardTitle>Stock Management</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                <div>
                  <h3 className="text-lg font-semibold mb-2">Total Stock in Godown</h3>
                  <p className="text-3xl font-bold">{godownStock} flowers</p>
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-2">Stock in Hand</h3>
                  <p className="text-3xl font-bold">{availableStock} flowers</p>
                </div>
                <div className="grid w-full max-w-sm items-center gap-1.5">
                  <Label htmlFor="flowersFromFarm">Add Flowers</Label>
                  <Input
                    type="number"
                    id="flowersFromFarm"
                    value={flowersFromFarm}
                    onChange={(e) => setFlowersFromFarm(e.target.value)}
                    placeholder="Number of flowers"
                  />
                </div>
                <div className="grid w-full max-w-sm items-center gap-1.5">
                  <Label htmlFor="farmMovementDate">Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-[240px] justify-start text-left font-normal",
                          !farmMovementDate && "text-muted-foreground"
                        )}
                      >
                        {farmMovementDate ? (
                          format(farmMovementDate, "PPP")
                        ) : (
                          <span>Pick a date</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={farmMovementDate}
                        onSelect={(date) => date && setFarmMovementDate(date)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="flex gap-2">
                  <Button 
                    onClick={() => {
                      setFarmMovementType("godown")
                      addFlowersFromFarm()
                    }}
                  >
                    <Flower className="mr-2 h-4 w-4" /> Add to Godown Stock
                  </Button>
                  <Button 
                    onClick={() => {
                      setFarmMovementType("available")
                      addFlowersFromFarm()
                    }}
                  >
                    <Flower className="mr-2 h-4 w-4" /> Add to Stock in Hand
                  </Button>
                </div>
                <div className="mt-8">
                  <h3 className="text-lg font-semibold mb-4">Stock Movement History</h3>
                  <div className="grid gap-2 mb-4">
                    <div className="flex gap-2">
                      <div className="grid gap-2">
                        <Label>Start Date</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant={"outline"}
                              className={cn(
                                "w-[240px] justify-start text-left font-normal",
                                !stockStartDate && "text-muted-foreground"
                              )}
                            >
                              {stockStartDate ? (
                                format(stockStartDate, "PPP")
                              ) : (
                                <span>Pick a date</span>
                              )}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={stockStartDate}
                              onSelect={setStockStartDate}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </div>

                      <div className="grid gap-2">
                        <Label>End Date</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant={"outline"}
                              className={cn(
                                "w-[240px] justify-start text-left font-normal",
                                !stockEndDate && "text-muted-foreground"
                              )}
                            >
                              {stockEndDate ? (
                                format(stockEndDate, "PPP")
                              ) : (
                                <span>Pick a date</span>
                              )}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={stockEndDate}
                              onSelect={setStockEndDate}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </div>

                      <div className="grid gap-2">
                        <Label>&nbsp;</Label>
                        <Button 
                          variant="outline"
                          onClick={() => {
                            setStockStartDate(undefined)
                            setStockEndDate(undefined)
                          }}
                        >
                          Reset Dates
                        </Button>
                      </div>
                    </div>
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Quantity</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stockMovements
                        .filter((m) => {
                          const movementDate = new Date(m.date)
                          return (!stockStartDate || movementDate >= stockStartDate) &&
                                 (!stockEndDate || movementDate <= stockEndDate)
                        })
                        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                        .map((movement) => (
                          <TableRow key={movement.id}>
                            <TableCell>{new Date(movement.date).toLocaleDateString()}</TableCell>
                            <TableCell>{movement.type === 'godown' ? 'Total Stock in Godown' : 'Stock in Hand'}</TableCell>
                            <TableCell>{movement.quantity}</TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>

                  <Button 
                    onClick={() => {
                      const filteredMovements = stockMovements
                        .filter((m) => {
                          const movementDate = new Date(m.date)
                          return (!stockStartDate || movementDate >= stockStartDate) &&
                                 (!stockEndDate || movementDate <= stockEndDate)
                        })
                        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

                      const printWindow = window.open('', '', 'height=500,width=800');
                      if (printWindow) {
                        printWindow.document.write(`
                          <html>
                            <head>
                              <title>Stock Movement History</title>
                              <style>
                                body { font-family: Arial, sans-serif; padding: 20px; }
                                table { 
                                  width: 100%; 
                                  border-collapse: collapse; 
                                  margin-bottom: 20px;
                                }
                                th, td { 
                                  border: 1px solid black; 
                                  padding: 8px; 
                                  text-align: left; 
                                }
                                th { 
                                  background-color: #f0f0f0; 
                                  font-weight: bold;
                                }
                                .summary { margin-bottom: 20px; }
                                @media print {
                                  button { display: none; }
                                  @page { margin: 2cm; }
                                }
                              </style>
                            </head>
                            <body>
                              <h2>Stock Movement History</h2>
                              ${stockStartDate ? `<p>From: ${stockStartDate.toLocaleDateString()}</p>` : ''}
                              ${stockEndDate ? `<p>To: ${stockEndDate.toLocaleDateString()}</p>` : ''}
                              <div class="summary">
                                <h3>Summary</h3>
                                <p>Total Movements: ${filteredMovements.length}</p>
                                <p>Total Added to Godown: ${filteredMovements
                                  .filter(m => m.type === 'godown')
                                  .reduce((sum, m) => sum + m.quantity, 0)}</p>
                                <p>Total Added to Stock in Hand: ${filteredMovements
                                  .filter(m => m.type === 'available')
                                  .reduce((sum, m) => sum + m.quantity, 0)}</p>
                              </div>
                              <table>
                                <thead>
                                  <tr>
                                    <th>Date</th>
                                    <th>Type</th>
                                    <th>Quantity</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  ${filteredMovements.map(m => `
                                    <tr>
                                      <td>${new Date(m.date).toLocaleDateString()}</td>
                                      <td>${m.type === 'godown' ? 'Total Stock in Godown' : 'Stock in Hand'}</td>
                                      <td>${m.quantity}</td>
                                    </tr>
                                  `).join('')}
                                </tbody>
                              </table>
                            </body>
                          </html>
                        `);
                        printWindow.document.close();
                        printWindow.focus();
                        printWindow.print();
                        printWindow.close();
                      }
                    }}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Print History
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="shops">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <CardTitle>Manage Shops</CardTitle>
              <div className="w-[240px]">
                <Select
                  value={shopSearch || "all"}
                  onValueChange={(value) => setShopSearch(value === "all" ? "" : value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Shop" />
                  </SelectTrigger>
                  <SelectContent>
                    <Input
                      placeholder="Search shops..."
                      value={shopSearch}
                      onChange={(e) => setShopSearch(e.target.value)}
                      className="mb-2"
                    />
                    <SelectItem value="all">All Shops</SelectItem>
                    {shops
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map((shop) => (
                        <SelectItem key={shop.id} value={shop.name}>
                          {shop.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {shops
                  .filter(shop => 
                    !shopSearch || 
                    shop.name.toLowerCase().includes(shopSearch.toLowerCase()) ||
                    shop.owner.toLowerCase().includes(shopSearch.toLowerCase())
                  )
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((shop) => (
                    <Card key={shop.id} className="bg-gradient-to-r from-slate-50 to-slate-100">
                      <CardContent className="pt-6 relative">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute top-2 right-2"
                          onClick={() => setEditingShop(shop)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <div className="border-b pb-4 mb-4">
                          <h2 className="text-2xl font-bold text-left text-slate-800">{shop.name}</h2>
                        </div>
                        <div className="grid gap-4 text-slate-600">
                          <div className="flex flex-col sm:flex-row sm:justify-between gap-2">
                            <div className="flex gap-2">
                              <span className="font-semibold min-w-[4rem]">Owner:</span>
                              <span>{shop.owner}</span>
                            </div>
                            <div className="flex gap-2">
                              <span className="font-semibold">Phone:</span>
                              <span><a href={`tel:${shop.phone}`}>{shop.phone}</a></span>
                            </div>
                          </div>
                          {shop.alternateNumbers.map((number, index) => (
                            <div key={index} className="flex gap-2">
                              <span className="font-semibold min-w-[4rem]">{number.name}:</span>
                              <span><a href={`tel:${number.number}`}>{number.number}</a></span>
                            </div>
                          ))}
                          <div className="flex gap-2">
                            <span className="font-semibold min-w-[4rem]">Address:</span>
                            <span>{shop.address}</span>
                          </div>
                          {shop.location && (
                            <div className="flex gap-2">
                              <Button
                                variant="link"
                                className="p-0 h-auto font-normal"
                                onClick={() =>
                                  window.open(
                                    `https://www.google.com/maps/search/?api=1&query=${shop.location}`,
                                    "_blank",
                                  )
                                }
                              >
                                <MapPin className="mr-2 h-4 w-4" />
                                View Location
                              </Button>
                            </div>
                          )}
                          <div className="border-t pt-4 mt-2">
                            <div className="flex gap-2">
                              <span className="font-semibold min-w-[4rem]">Balance:</span>
                              <span>₹{getShopBalance(shop.id).toFixed(2)}</span>
                            </div>
                            {getLastDeliveryDetails(shop.id) && (
                              <div className="mt-2">
                                <div className="font-semibold mb-1">Last Delivery:</div>
                                <div className="grid gap-1 pl-4">
                                  <div>Date: {getLastDeliveryDetails(shop.id)?.date}</div>
                                  <div>Flowers: {getLastDeliveryDetails(shop.id)?.flowersSold}</div>
                                  <div>Rate: ₹{getLastDeliveryDetails(shop.id)?.rate}</div>
                                </div>
                              </div>
                            )}
                          </div>
                          <Button 
                            className="mt-2"
                            onClick={() => setSelectedShopForHistory(shop)}
                          >
                            View Details
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Transaction History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                <div className="flex flex-wrap gap-4">
                  <div className="grid gap-2">
                    <Label>Start Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-[240px] justify-start text-left font-normal",
                            !transactionStartDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {transactionStartDate ? format(transactionStartDate, "PPP") : <span>Pick a date</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={transactionStartDate}
                          onSelect={setTransactionStartDate}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="grid gap-2">
                    <Label>End Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-[240px] justify-start text-left font-normal",
                            !transactionEndDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {transactionEndDate ? format(transactionEndDate, "PPP") : <span>Pick a date</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={transactionEndDate}
                          onSelect={setTransactionEndDate}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="grid gap-2">
                    <Label>Shop</Label>
                    <div className="flex gap-2">
                      <Select
                        value={historyFilter.shop || "all"}
                        onValueChange={(value) => setHistoryFilter({ ...historyFilter, shop: value === "all" ? "" : value })}
                      >
                        <SelectTrigger className="w-[240px]">
                          <SelectValue placeholder="All Shops" />
                        </SelectTrigger>
                        <SelectContent>
                          <Input
                            placeholder="Search shops..."
                            value={shopSearch}
                            onChange={(e) => setShopSearch(e.target.value)}
                            className="mb-2"
                          />
                          <SelectItem value="all">All Shops</SelectItem>
                          {shops
                            .filter(shop => 
                              shop.name.toLowerCase().includes(shopSearch.toLowerCase()) ||
                              shop.owner.toLowerCase().includes(shopSearch.toLowerCase())
                            )
                            .sort((a, b) => a.name.localeCompare(b.name))
                            .map((shop) => (
                              <SelectItem key={shop.id} value={shop.id}>
                                {shop.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label>&nbsp;</Label>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline"
                        onClick={() => {
                          setTransactionStartDate(undefined);
                          setTransactionEndDate(undefined);
                          setHistoryFilter({ ...historyFilter, shop: "" });
                          setShopSearch("");
                        }}
                      >
                        Reset All Filters
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold">
                        {getFilteredTransactions(transactions, trendChartPeriod, { from: transactionStartDate, to: transactionEndDate })
                          .filter(t => !historyFilter.shop || t.shopId === historyFilter.shop)
                          .reduce((sum, t) => sum + t.flowersSold, 0)}
                      </div>
                      <p className="text-muted-foreground">Total Flowers Sold</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold">₹{
                        getFilteredTransactions(transactions, trendChartPeriod, { from: transactionStartDate, to: transactionEndDate })
                          .filter(t => !historyFilter.shop || t.shopId === historyFilter.shop)
                          .reduce((sum, t) => sum + (t.flowersSold * t.rate), 0).toFixed(2)
                      }</div>
                      <p className="text-muted-foreground">Total Amount</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold">₹{
                        getFilteredTransactions(transactions, trendChartPeriod, { from: transactionStartDate, to: transactionEndDate })
                          .filter(t => !historyFilter.shop || t.shopId === historyFilter.shop)
                          .reduce((sum, t) => sum + t.cashReceived, 0).toFixed(2)
                      }</div>
                      <p className="text-muted-foreground">Total Received</p>
                    </CardContent>
                  </Card>
                </div>

                <div className="overflow-x-auto -mx-4 sm:mx-0">
                  <div className="inline-block min-w-full align-middle">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Flowers Sold</TableHead>
                          <TableHead>Rate (₹)</TableHead>
                          <TableHead>Total (₹)</TableHead>
                          <TableHead>Received (₹)</TableHead>
                          <TableHead>Outstanding (₹)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {getFilteredTransactions(transactions, trendChartPeriod, { from: transactionStartDate, to: transactionEndDate })
                          .filter(t => !historyFilter.shop || t.shopId === historyFilter.shop)
                          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                          .map((transaction) => {
                            const shop = shops.find((s) => s.id === transaction.shopId)
                            return (
                              <TableRow key={transaction.id}>
                                <TableCell>{new Date(transaction.date).toLocaleDateString()}</TableCell>
                                <TableCell>{transaction.flowersSold}</TableCell>
                                <TableCell>{transaction.rate.toFixed(2)}</TableCell>
                                <TableCell>{(transaction.flowersSold * transaction.rate).toFixed(2)}</TableCell>
                                <TableCell>{transaction.cashReceived.toFixed(2)}</TableCell>
                                <TableCell>{transaction.outstandingBalance.toFixed(2)}</TableCell>
                              </TableRow>
                            )
                          })}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                <Button 
                  variant="outline"
                  onClick={() => {
                    setHistoryFilter({ ...historyFilter, shop: "" });
                    setTransactionStartDate(undefined);
                    setTransactionEndDate(undefined);
                  }}
                >
                  Reset Filters
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showAddShopDialog} onOpenChange={setShowAddShopDialog}>
        <DialogContent aria-describedby="add-shop-dialog-description">
          <DialogHeader>
            <DialogTitle>Add New Shop</DialogTitle>
            <p id="add-shop-dialog-description" className="text-sm text-muted-foreground">
              Enter the details of the new shop to add it to your list.
            </p>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Name
              </Label>
              <Input
                id="name"
                value={newShop.name}
                onChange={(e) => setNewShop({ ...newShop, name: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="owner" className="text-right">
                Owner
              </Label>
              <Input
                id="owner"
                value={newShop.owner}
                onChange={(e) => setNewShop({ ...newShop, owner: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="phone" className="text-right">
                Phone
              </Label>
              <Input
                id="phone"
                value={newShop.phone}
                onChange={(e) => setNewShop({ ...newShop, phone: e.target.value })}
                className="col-span-3"
              />
            </div>
            {newShop.alternateNumbers.map((number, index) => (
              <div key={index} className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor={`alternateName${index}`} className="text-right">
                  Alternate Name
                </Label>
                <Input
                  id={`alternateName${index}`}
                  value={number.name}
                  onChange={(e) => {
                    const updatedNumbers = [...newShop.alternateNumbers]
                    updatedNumbers[index] = { ...updatedNumbers[index], name: e.target.value }
                    setNewShop({ ...newShop, alternateNumbers: updatedNumbers })
                  }}
                  className="col-span-3"
                />
                <Label htmlFor={`alternateNumber${index}`} className="text-right">
                  Alternate Number
                </Label>
                <Input
                  id={`alternateNumber${index}`}
                  value={number.number}
                  onChange={(e) => {
                    const updatedNumbers = [...newShop.alternateNumbers]
                    updatedNumbers[index] = { ...updatedNumbers[index], number: e.target.value }
                    setNewShop({ ...newShop, alternateNumbers: updatedNumbers })
                  }}
                  className="col-span-3"
                />
              </div>
            ))}
            <Button
              onClick={() =>
                setNewShop({ ...newShop, alternateNumbers: [...newShop.alternateNumbers, { name: "", number: "" }] })
              }
            >
              Add Another Number
            </Button>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="address" className="text-right">
                Address
              </Label>
              <Input
                id="address"
                value={newShop.address}
                onChange={(e) => setNewShop({ ...newShop, address: e.target.value })}
                className="col-span-3"
              />
            </div>
            <Button
              onClick={() => {
                if (navigator.geolocation) {
                  navigator.geolocation.getCurrentPosition((position) => {
                    const { latitude, longitude } = position.coords
                    setNewShop({ ...newShop, location: `${latitude},${longitude}` })
                  })
                } else {
                  alert("Geolocation is not supported by this browser.")
                }
              }}
            >
              <MapPin className="mr-2 h-4 w-4" />
              Get Current Location
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={addShop}>Add Shop</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {editingShop && (
        <Dialog open={!!editingShop} onOpenChange={() => setEditingShop(null)}>
          <DialogContent aria-describedby="edit-shop-dialog-description">
            <DialogHeader>
              <DialogTitle>Edit Shop</DialogTitle>
              <p id="edit-shop-dialog-description" className="text-sm text-muted-foreground">
                Update the shop's information.
              </p>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">
                  Name
                </Label>
                <Input
                  id="name"
                  value={editingShop.name}
                  onChange={(e) => setEditingShop({ ...editingShop, name: e.target.value })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="owner" className="text-right">
                  Owner
                </Label>
                <Input
                  id="owner"
                  value={editingShop.owner}
                  onChange={(e) => setEditingShop({ ...editingShop, owner: e.target.value })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="phone" className="text-right">
                  Phone
                </Label>
                <Input
                  id="phone"
                  value={editingShop.phone}
                  onChange={(e) => setEditingShop({ ...editingShop, phone: e.target.value })}
                  className="col-span-3"
                />
              </div>
              {editingShop.alternateNumbers.map((number, index) => (
                <div key={index} className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor={`alternateName${index}`} className="text-right">
                    Alternate Name
                  </Label>
                  <Input
                    id={`alternateName${index}`}
                    value={number.name}
                    onChange={(e) => {
                      const updatedNumbers = [...editingShop.alternateNumbers]
                      updatedNumbers[index] = { ...updatedNumbers[index], name: e.target.value }
                      setEditingShop({ ...editingShop, alternateNumbers: updatedNumbers })
                    }}
                    className="col-span-3"
                  />
                  <Label htmlFor={`alternateNumber${index}`} className="text-right">
                    Alternate Number
                  </Label>
                  <Input
                    id={`alternateNumber${index}`}
                    value={number.number}
                    onChange={(e) => {
                      const updatedNumbers = [...editingShop.alternateNumbers]
                      updatedNumbers[index] = { ...updatedNumbers[index], number: e.target.value }
                      setEditingShop({ ...editingShop, alternateNumbers: updatedNumbers })
                    }}
                    className="col-span-3"
                  />
                  <Button
                    onClick={() => {
                      const updatedNumbers = editingShop.alternateNumbers.filter((_, i) => i !== index)
                      setEditingShop({ ...editingShop, alternateNumbers: updatedNumbers })
                    }}
                    variant="destructive"
                  >
                    Remove
                  </Button>
                </div>
              ))}
              <Button
                onClick={() =>
                  setEditingShop({
                    ...editingShop,
                    alternateNumbers: [...editingShop.alternateNumbers, { name: "", number: "" }],
                  })
                }
              >
                Add Another Number
              </Button>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="address" className="text-right">
                  Address
                </Label>
                <Input
                  id="address"
                  value={editingShop.address}
                  onChange={(e) => setEditingShop({ ...editingShop, address: e.target.value })}
                  className="col-span-3"
                />
              </div>
              <Button
                onClick={() => {
                  if (navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition((position) => {
                      const { latitude, longitude } = position.coords
                      setEditingShop({ ...editingShop, location: `${latitude},${longitude}` })
                    })
                  } else {
                    alert("Geolocation is not supported by this browser.")
                  }
                }}
              >
                <MapPin className="mr-2 h-4 w-4" />
                Update Location
              </Button>
            </div>
            <DialogFooter>
              <Button onClick={updateShop}>Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {editingTransaction && (
        <Dialog open={!!editingTransaction} onOpenChange={() => setEditingTransaction(null)}>
          <DialogContent aria-describedby="edit-transaction-dialog-description">
            <DialogHeader>
              <DialogTitle>Edit Transaction</DialogTitle>
              <p id="edit-transaction-dialog-description" className="text-sm text-muted-foreground">
                Modify the transaction details.
              </p>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="flowersSold" className="text-right">
                  Flowers Sold
                </Label>
                <Input
                  id="flowersSold"
                  value={editingTransaction.flowersSold}
                  onChange={(e) =>
                    setEditingTransaction({ ...editingTransaction, flowersSold: Number.parseInt(e.target.value) })
                  }
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="rate" className="text-right">
                  Rate (₹)
                </Label>
                <Input
                  id="rate"
                  value={editingTransaction.rate}
                  onChange={(e) =>
                    setEditingTransaction({ ...editingTransaction, rate: Number.parseFloat(e.target.value) })
                  }
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="cashReceived" className="text-right">
                  Cash Received (₹)
                </Label>
                <Input
                  id="cashReceived"
                  value={editingTransaction.cashReceived}
                  onChange={(e) =>
                    setEditingTransaction({ ...editingTransaction, cashReceived: Number.parseFloat(e.target.value) })
                  }
                  className="col-span-3"
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={updateTransaction}>Save changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <Dialog open={showReceiptDialog} onOpenChange={setShowReceiptDialog}>
        <DialogContent className="sm:max-w-[425px]" aria-describedby="receipt-dialog-description">
          <DialogHeader>
            <DialogTitle>Receipt Options</DialogTitle>
            <p id="receipt-dialog-description" className="text-sm text-muted-foreground">
              Choose how you would like to receive the receipt.
            </p>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <Button
              onClick={() => {
                const receipt = generateReceipt();
                if (receipt) {
                  navigator.clipboard.writeText(receipt);
                  toast({
                    title: "Copied to clipboard",
                    description: "Receipt has been copied to clipboard"
                  });
                }
              }}
            >
              Copy to Clipboard
            </Button>
            <Button
              onClick={() => {
                const receipt = generateReceipt();
                if (receipt) {
                  const blob = new Blob([receipt], { type: 'text/plain' });
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement('a');
                  link.href = url;
                  link.download = `receipt_${selectedShop?.name}_${saleDate.toISOString().split('T')[0]}.txt`;
                  link.click();
                  URL.revokeObjectURL(url);
                }
              }}
            >
              Download Text File
            </Button>
            <Button variant="outline" onClick={() => setShowReceiptDialog(false)}>
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {selectedShopForHistory && (
        <Dialog open={!!selectedShopForHistory} onOpenChange={() => setSelectedShopForHistory(null)}>
          <DialogContent 
            className="max-w-4xl max-h-[80vh] overflow-y-auto" 
            aria-describedby="shop-details-dialog-description"
          >
            <DialogHeader>
              <p id="shop-details-dialog-description" className="text-sm text-muted-foreground">
                View detailed information and transaction history for this shop.
              </p>
            </DialogHeader>
            <div className="grid gap-4 py-4" id="printableShopDetails">
              <Card className="bg-gradient-to-r from-slate-50 to-slate-100">
                <CardContent className="pt-6">
                  <div className="border-b pb-4 mb-4">
                    <h2 className="text-2xl font-bold text-left text-slate-800">{selectedShopForHistory.name}</h2>
                  </div>
                  <div className="grid gap-4 text-slate-600">
                    <div className="flex flex-col sm:flex-row sm:justify-between gap-2">
                      <div className="flex gap-2">
                        <span className="font-semibold min-w-[4rem]">Owner:</span>
                        <span>{selectedShopForHistory.owner}</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="font-semibold">Phone:</span>
                        <span>{selectedShopForHistory.phone}</span>
                      </div>
                    </div>
                    {selectedShopForHistory.alternateNumbers.map((number, index) => (
                      <div key={index} className="flex gap-2">
                        <span className="font-semibold min-w-[4rem]">{number.name}:</span>
                        <span>{number.number}</span>
                      </div>
                    ))}
                    <div className="flex gap-2">
                      <span className="font-semibold min-w-[4rem]">Address:</span>
                      <span>{selectedShopForHistory.address}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-between items-center gap-4">
                <h3 className="text-lg font-semibold">Transaction History</h3>
                <div className="flex gap-4">
                  <div className="grid gap-2">
                    <Label>Start Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-[240px] justify-start text-left font-normal",
                            !transactionStartDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {transactionStartDate ? format(transactionStartDate, "PPP") : <span>Pick a date</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={transactionStartDate}
                          onSelect={setTransactionStartDate}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="grid gap-2">
                    <Label>End Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-[240px] justify-start text-left font-normal",
                            !transactionEndDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {transactionEndDate ? format(transactionEndDate, "PPP") : <span>Pick a date</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={transactionEndDate}
                          onSelect={setTransactionEndDate}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="grid gap-2">
                    <Label>&nbsp;</Label>
                    <Button 
                      variant="outline"
                      onClick={() => {
                        setTransactionStartDate(undefined);
                        setTransactionEndDate(undefined);
                      }}
                    >
                      Reset Dates
                    </Button>
                  </div>
                </div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Flowers Sold</TableHead>
                    <TableHead>Rate (₹)</TableHead>
                    <TableHead>Total (₹)</TableHead>
                    <TableHead>Received (₹)</TableHead>
                    <TableHead>Outstanding (₹)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {getShopTransactions(selectedShopForHistory.id)
                    .filter(t => {
                      const transactionDate = new Date(t.date);
                      return (!transactionStartDate || transactionDate >= transactionStartDate) &&
                             (!transactionEndDate || transactionDate <= transactionEndDate);
                    })
                    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                    .map((transaction) => (
                      <TableRow key={transaction.id}>
                        <TableCell>{new Date(transaction.date).toLocaleDateString()}</TableCell>
                        <TableCell>{transaction.flowersSold}</TableCell>
                        <TableCell>{transaction.rate.toFixed(2)}</TableCell>
                        <TableCell>{(transaction.flowersSold * transaction.rate).toFixed(2)}</TableCell>
                        <TableCell>{transaction.cashReceived.toFixed(2)}</TableCell>
                        <TableCell>{transaction.outstandingBalance.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
              <div className="grid gap-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Description</TableHead>
                      <TableHead>Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(() => {
                      const filteredTransactions = getShopTransactions(selectedShopForHistory.id)
                        .filter(t => {
                          const transactionDate = new Date(t.date);
                          return (!transactionStartDate || transactionDate >= transactionStartDate) &&
                                 (!transactionEndDate || transactionDate <= transactionEndDate);
                        });
                      
                      return (
                        <>
                          <TableRow>
                            <TableCell>Total Flowers Sold</TableCell>
                            <TableCell>{filteredTransactions.reduce((sum, t) => sum + t.flowersSold, 0)}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>Total Amount</TableCell>
                            <TableCell>₹{filteredTransactions
                              .reduce((sum, t) => sum + (t.flowersSold * t.rate), 0).toFixed(2)}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>Total Received</TableCell>
                            <TableCell>₹{filteredTransactions
                              .reduce((sum, t) => sum + t.cashReceived, 0).toFixed(2)}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>Current Outstanding</TableCell>
                            <TableCell>₹{getShopBalance(selectedShopForHistory.id).toFixed(2)}</TableCell>
                          </TableRow>
                        </>
                      );
                    })()}
                  </TableBody>
                </Table>
              </div>
              <Button
                onClick={() => {
                  const printContent = document.getElementById('printableShopDetails')?.innerHTML;
                  const printWindow = window.open('', '', 'height=500,width=800');
                  if (printWindow) {
                    printWindow.document.write(`
                      <html>
                        <head>
                          <title>${selectedShopForHistory.name} - Details</title>
                          <style>
                            body { font-family: Arial, sans-serif; padding: 20px; }
                            table { 
                              width: 100%; 
                              border-collapse: collapse; 
                              margin-bottom: 20px;
                            }
                            th, td { 
                              border: 1px solid black; 
                              padding: 8px; 
                              text-align: left; 
                            }
                            th { 
                              background-color: #f0f0f0; 
                              font-weight: bold;
                            }
                            .shop-details {
                              margin-bottom: 20px;
                            }
                            .shop-details div {
                              margin-bottom: 8px;
                            }
                            .label {
                              font-weight: bold;
                              margin-right: 8px;
                            }
                            @media print {
                              button { display: none; }
                              @page { margin: 2cm; }
                            }
                          </style>
                        </head>
                        <body>
                          ${printContent}
                        </body>
                      </html>
                    `);
                    printWindow.document.close();
                    printWindow.focus();
                    printWindow.print();
                    printWindow.close();
                  }
                }}
              >
                <Download className="mr-2 h-4 w-4" />
                Print Details
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

