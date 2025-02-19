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
import { DatePicker } from "@/components/ui/date-picker"
import { Calendar } from "@/components/ui/calendar"
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts"
import * as XLSX from "xlsx"

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

  useEffect(() => {
    const savedShops = localStorage.getItem("shops")
    const savedTransactions = localStorage.getItem("transactions")
    const savedFarmMovements = localStorage.getItem("farmMovements")
    const savedStock = localStorage.getItem("availableStock")
    const savedGodownStock = localStorage.getItem("godownStock")

    if (savedShops) setShops(JSON.parse(savedShops))
    if (savedTransactions) setTransactions(JSON.parse(savedTransactions))
    if (savedFarmMovements) setFarmMovements(JSON.parse(savedFarmMovements))
    if (savedStock) setAvailableStock(JSON.parse(savedStock))
    if (savedGodownStock) setGodownStock(JSON.parse(savedGodownStock))
  }, [])

  useEffect(() => {
    localStorage.setItem("shops", JSON.stringify(shops))
    localStorage.setItem("transactions", JSON.stringify(transactions))
    localStorage.setItem("farmMovements", JSON.stringify(farmMovements))
    localStorage.setItem("availableStock", JSON.stringify(availableStock))
    localStorage.setItem("godownStock", JSON.stringify(godownStock))
  }, [shops, transactions, farmMovements, availableStock, godownStock])

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
      const newMovement: FarmMovement = {
        id: Date.now().toString(),
        flowersAdded,
        date: farmMovementDate.toISOString(),
        type: farmMovementType,
      }

      setFarmMovements(
        [...farmMovements, newMovement].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
      )
      if (farmMovementType === "available") {
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
    if (!selectedShop) return

    const lastTransaction = getLastDeliveryDetails(selectedShop.id)
    const currentBalance = getShopBalance(selectedShop.id)

    const receiptContent = `
Coconut Flower
Phone: 9943676453
------------------------
Shop: ${selectedShop.name}
Date: ${saleDate.toLocaleDateString()}
Last Delivery: ${lastTransaction ? `${lastTransaction.date} - ${lastTransaction.flowersSold} flowers at ₹${lastTransaction.rate}` : "N/A"}
Flowers Sold: ${flowersSold}
Rate: ₹${rate}
Total Amount: ₹${(Number.parseInt(flowersSold) * Number.parseFloat(rate)).toFixed(2)}
Cash Received: ₹${cashReceived}
Previous Balance: ₹${currentBalance.toFixed(2)}
New Balance: ₹${(currentBalance + Number.parseInt(flowersSold) * Number.parseFloat(rate) - Number.parseFloat(cashReceived)).toFixed(2)}
------------------------
Thank you for your business!
    `

    const blob = new Blob([receiptContent], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `receipt_${selectedShop.name}_${saleDate.toISOString().split("T")[0]}.txt`
    link.click()
    URL.revokeObjectURL(url)
  }

  const updateTransaction = () => {
    if (editingTransaction) {
      const updatedTransactions = transactions.map((t) => {
        if (t.id === editingTransaction.id) {
          return editingTransaction
        }
        return t
      })

      // Recalculate outstanding balances for all transactions of this shop
      const shopTransactions = updatedTransactions
        .filter((t) => t.shopId === editingTransaction.shopId)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

      let runningBalance = 0
      shopTransactions.forEach((t) => {
        runningBalance += t.flowersSold * t.rate - t.cashReceived
        t.outstandingBalance = runningBalance
      })

      setTransactions(updatedTransactions)
      setEditingTransaction(null)
    }
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
        startDate = new Date(0) // Beginning of time
    }

    return shopTransactions
      .filter((t) => new Date(t.date) >= startDate && new Date(t.date) <= endDate)
      .map((t) => ({
        date: new Date(t.date).toLocaleDateString(),
        flowersSold: t.flowersSold,
      }))
  }

  const exportData = (data: any[], fileName: string) => {
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1")
    XLSX.writeFile(wb, `${fileName}.xlsx`)
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

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Coconut Flower Management</h1>

      <Tabs defaultValue="dashboard" className="space-y-4">
        <TabsList className="flex justify-start overflow-x-auto">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="sales">Record Sale</TabsTrigger>
          <TabsTrigger value="stock">Stock</TabsTrigger>
          <TabsTrigger value="shops">Shops</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <Card>
            <CardHeader>
              <CardTitle>Dashboard</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                <div>
                  <h3 className="text-lg font-semibold mb-2">Available Stock</h3>
                  <p className="text-3xl font-bold">{availableStock} flowers</p>
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-2">Godown Stock</h3>
                  <p className="text-3xl font-bold">{godownStock} flowers</p>
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-2">Total Outstanding</h3>
                  <p className="text-3xl font-bold">₹{getTotalOutstanding().toFixed(2)}</p>
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-2">Shops with Outstanding Balance</h3>
                  <ul>
                    {getShopsWithOutstanding().map((shop) => (
                      <li key={shop.id}>
                        {shop.name}: ₹{getShopBalance(shop.id).toFixed(2)}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-2">Summary</h3>
                  <div className="grid grid-cols-3 gap-4">
                    {["day", "week", "month"].map((period) => {
                      const summary = getSummary(period as "day" | "week" | "month")
                      return (
                        <Card key={period}>
                          <CardHeader>
                            <CardTitle className="capitalize">{period}</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p>Total Sold: {summary.totalSold}</p>
                            <p>Total Amount: ₹{summary.totalAmount.toFixed(2)}</p>
                            <p>Total Received: ₹{summary.totalReceived.toFixed(2)}</p>
                            <p>Balance: ₹{summary.balance.toFixed(2)}</p>
                            <p>Average Price: ₹{summary.averagePrice.toFixed(2)}</p>
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
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
                  <Card className="p-4 relative">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-2 right-2"
                      onClick={() => setEditingShop(selectedShop)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="font-semibold">Shop Name:</p>
                        <p>{selectedShop.name}</p>
                      </div>
                      <div>
                        <p className="font-semibold">Owner:</p>
                        <p>{selectedShop.owner}</p>
                      </div>
                      <div>
                        <p className="font-semibold">Phone:</p>
                        <p>
                          <a href={`tel:${selectedShop.phone}`}>{selectedShop.phone}</a>
                        </p>
                      </div>
                      <div>
                        <p className="font-semibold">Address:</p>
                        <p>{selectedShop.address}</p>
                      </div>
                      {selectedShop.alternateNumbers.map((number, index) => (
                        <div key={index}>
                          <p className="font-semibold">{number.name}:</p>
                          <p>
                            <a href={`tel:${number.number}`}>{number.number}</a>
                          </p>
                        </div>
                      ))}
                      {selectedShop.location && (
                        <div className="col-span-2">
                          <Button
                            variant="link"
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
                    </div>
                    <div className="mt-4">
                      <p className="font-semibold">Current Balance:</p>
                      <p>₹{getShopBalance(selectedShop.id).toFixed(2)}</p>
                    </div>
                    {getLastDeliveryDetails(selectedShop.id) && (
                      <div className="mt-4">
                        <p className="font-semibold">Last Delivery:</p>
                        <p>Date: {getLastDeliveryDetails(selectedShop.id)?.date}</p>
                        <p>Flowers Sold: {getLastDeliveryDetails(selectedShop.id)?.flowersSold}</p>
                        <p>Rate: ₹{getLastDeliveryDetails(selectedShop.id)?.rate}</p>
                      </div>
                    )}
                  </Card>
                )}
                <div className="grid w-full max-w-sm items-center gap-1.5">
                  <Label htmlFor="saleDate">Sale Date</Label>
                  <DatePicker date={saleDate} setDate={setSaleDate} />
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
                  <h3 className="text-lg font-semibold mb-2">Godown Stock</h3>
                  <p className="text-3xl font-bold">{godownStock} flowers</p>
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-2">Available Stock</h3>
                  <p className="text-3xl font-bold">{availableStock} flowers</p>
                </div>
                <div className="grid w-full max-w-sm items-center gap-1.5">
                  <Label htmlFor="flowersFromFarm">Add Flowers</Label>
                  <Input
                    type="number"
                    id="flowersFromFarm"
                    value={flowersFromFarm}
                    onChange={(e) => setFlowersFromFarm(e.target.value)}
                    placeholder="Enter number of flowers"
                  />
                </div>
                <div className="grid w-full max-w-sm items-center gap-1.5">
                  <Label htmlFor="farmMovementDate">Date</Label>
                  <DatePicker date={farmMovementDate} setDate={setFarmMovementDate} />
                </div>
                <div className="grid w-full max-w-sm items-center gap-1.5">
                  <Label htmlFor="farmMovementType">Add to</Label>
                  <Select onValueChange={(value: "godown" | "available") => setFarmMovementType(value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select stock type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="godown">Godown Stock</SelectItem>
                      <SelectItem value="available">Available Stock</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={addFlowersFromFarm}>
                  <Flower className="mr-2 h-4 w-4" /> Add to Stock
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="shops">
          <Card>
            <CardHeader>
              <CardTitle>Manage Shops</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {shops
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((shop) => (
                    <Card key={shop.id} className="p-4 relative">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2"
                        onClick={() => setEditingShop(shop)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <div className="grid gap-2">
                        <div>
                          <p className="font-semibold">Shop Name:</p>
                          <p>{shop.name}</p>
                        </div>
                        <div>
                          <p className="font-semibold">Owner:</p>
                          <p>{shop.owner}</p>
                        </div>
                        <div>
                          <p className="font-semibold">Phone:</p>
                          <p>
                            <a href={`tel:${shop.phone}`}>{shop.phone}</a>
                          </p>
                        </div>
                        <div>
                          <p className="font-semibold">Address:</p>
                          <p>{shop.address}</p>
                        </div>
                        <Button onClick={() => setSelectedShopForHistory(shop)}>View Details</Button>
                      </div>
                    </Card>
                  ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  className="rounded-md border"
                />
                {selectedDate && (
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Transactions on {selectedDate.toLocaleDateString()}</h3>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="cursor-pointer" onClick={() => requestSort("shopId")}>
                            Shop {sortConfig?.key === "shopId" && (sortConfig.direction === "ascending" ? "↑" : "↓")}
                          </TableHead>
                          <TableHead className="cursor-pointer" onClick={() => requestSort("flowersSold")}>
                            Flowers Sold{" "}
                            {sortConfig?.key === "flowersSold" && (sortConfig.direction === "ascending" ? "↑" : "↓")}
                          </TableHead>
                          <TableHead className="cursor-pointer" onClick={() => requestSort("rate")}>
                            Rate (₹) {sortConfig?.key === "rate" && (sortConfig.direction === "ascending" ? "↑" : "↓")}
                          </TableHead>
                          <TableHead className="cursor-pointer" onClick={() => requestSort("cashReceived")}>
                            Received (₹){" "}
                            {sortConfig?.key === "cashReceived" && (sortConfig.direction === "ascending" ? "↑" : "↓")}
                          </TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedTransactions
                          .filter((t) => new Date(t.date).toDateString() === selectedDate.toDateString())
                          .map((transaction) => {
                            const shop = shops.find((s) => s.id === transaction.shopId)
                            return (
                              <TableRow key={transaction.id}>
                                <TableCell>{shop?.name}</TableCell>
                                <TableCell>{transaction.flowersSold}</TableCell>
                                <TableCell>{transaction.rate.toFixed(2)}</TableCell>
                                <TableCell>{transaction.cashReceived.toFixed(2)}</TableCell>
                                <TableCell>
                                  <Button onClick={() => setEditingTransaction(transaction)}>
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            )
                          })}
                      </TableBody>
                    </Table>
                  </div>
                )}
                <div>
                  <h3 className="text-lg font-semibold mb-2">All Transactions</h3>
                  <div className="grid gap-2 mb-4">
                    <Input
                      placeholder="Filter by shop name"
                      value={historyFilter.shop}
                      onChange={(e) => setHistoryFilter({ ...historyFilter, shop: e.target.value })}
                    />
                    <div className="flex gap-2">
                      <Input
                        placeholder="Min rate"
                        type="number"
                        value={historyFilter.minRate}
                        onChange={(e) => setHistoryFilter({ ...historyFilter, minRate: e.target.value })}
                      />
                      <Input
                        placeholder="Max rate"
                        type="number"
                        value={historyFilter.maxRate}
                        onChange={(e) => setHistoryFilter({ ...historyFilter, maxRate: e.target.value })}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Min outstanding"
                        type="number"
                        value={historyFilter.minOutstanding}
                        onChange={(e) => setHistoryFilter({ ...historyFilter, minOutstanding: e.target.value })}
                      />
                      <Input
                        placeholder="Max outstanding"
                        type="number"
                        value={historyFilter.maxOutstanding}
                        onChange={(e) => setHistoryFilter({ ...historyFilter, maxOutstanding: e.target.value })}
                      />
                    </div>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="cursor-pointer" onClick={() => requestSort("date")}>
                          Date {sortConfig?.key === "date" && (sortConfig.direction === "ascending" ? "↑" : "↓")}
                        </TableHead>
                        <TableHead className="cursor-pointer" onClick={() => requestSort("shopId")}>
                          Shop {sortConfig?.key === "shopId" && (sortConfig.direction === "ascending" ? "↑" : "↓")}
                        </TableHead>
                        <TableHead className="cursor-pointer" onClick={() => requestSort("flowersSold")}>
                          Flowers Sold{" "}
                          {sortConfig?.key === "flowersSold" && (sortConfig.direction === "ascending" ? "↑" : "↓")}
                        </TableHead>
                        <TableHead className="cursor-pointer" onClick={() => requestSort("rate")}>
                          Rate (₹) {sortConfig?.key === "rate" && (sortConfig.direction === "ascending" ? "↑" : "↓")}
                        </TableHead>
                        <TableHead className="cursor-pointer" onClick={() => requestSort("cashReceived")}>
                          Received (₹){" "}
                          {sortConfig?.key === "cashReceived" && (sortConfig.direction === "ascending" ? "↑" : "↓")}
                        </TableHead>
                        <TableHead>Outstanding (₹)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedTransactions
                        .filter((t) => {
                          const shop = shops.find((s) => s.id === t.shopId)
                          return (
                            (!historyFilter.shop ||
                              (shop && shop.name.toLowerCase().includes(historyFilter.shop.toLowerCase()))) &&
                            (!historyFilter.minRate || t.rate >= Number.parseFloat(historyFilter.minRate)) &&
                            (!historyFilter.maxRate || t.rate <= Number.parseFloat(historyFilter.maxRate)) &&
                            (!historyFilter.minOutstanding ||
                              t.outstandingBalance >= Number.parseFloat(historyFilter.minOutstanding)) &&
                            (!historyFilter.maxOutstanding ||
                              t.outstandingBalance <= Number.parseFloat(historyFilter.maxOutstanding))
                          )
                        })
                        .map((transaction) => {
                          const shop = shops.find((s) => s.id === transaction.shopId)
                          return (
                            <TableRow key={transaction.id}>
                              <TableCell>{new Date(transaction.date).toLocaleDateString()}</TableCell>
                              <TableCell>{shop?.name}</TableCell>
                              <TableCell>{transaction.flowersSold}</TableCell>
                              <TableCell>{transaction.rate.toFixed(2)}</TableCell>
                              <TableCell>{transaction.cashReceived.toFixed(2)}</TableCell>
                              <TableCell>{transaction.outstandingBalance.toFixed(2)}</TableCell>
                            </TableRow>
                          )
                        })}
                    </TableBody>
                  </Table>
                </div>
                <Button onClick={() => exportData(sortedTransactions, "transaction_history")}>
                  <Download className="mr-2 h-4 w-4" />
                  Export Data
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showAddShopDialog} onOpenChange={setShowAddShopDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Shop</DialogTitle>
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
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Shop</DialogTitle>
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
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Transaction</DialogTitle>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Receipt</DialogTitle>
          </DialogHeader>
          <p>Do you want to generate and download the receipt?</p>
          <DialogFooter>
            <Button onClick={() => setShowReceiptDialog(false)}>Cancel</Button>
            <Button
              onClick={() => {
                generateReceipt()
                setShowReceiptDialog(false)
                setFlowersSold("")
                setRate("")
                setCashReceived("")
                setReplacedFlowers("")
                setSelectedShop(null)
                setSaleDate(new Date())
              }}
            >
              Generate Receipt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {selectedShopForHistory && (
        <Dialog open={!!selectedShopForHistory} onOpenChange={() => setSelectedShopForHistory(null)}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selectedShopForHistory.name} - Transaction History</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Trend Chart</h3>
                <Select onValueChange={(value: "month" | "7days" | "30days" | "all") => setTrendChartPeriod(value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select period" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="month">Last Month</SelectItem>
                    <SelectItem value="7days">Last 7 Days</SelectItem>
                    <SelectItem value="30days">Last 30 Days</SelectItem>
                    <SelectItem value="all">All Time</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={getShopDeliveryTrends(selectedShopForHistory.id)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="flowersSold" stroke="#8884d8" />
                </LineChart>
              </ResponsiveContainer>
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
                  {getShopTransactions(selectedShopForHistory.id).map((transaction) => (
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
              <div>
                <p>
                  Total Flowers Sold:{" "}
                  {getShopTransactions(selectedShopForHistory.id).reduce((sum, t) => sum + t.flowersSold, 0)}
                </p>
                <p>
                  Average Rate: ₹
                  {(
                    getShopTransactions(selectedShopForHistory.id).reduce((sum, t) => sum + t.rate, 0) /
                    getShopTransactions(selectedShopForHistory.id).length
                  ).toFixed(2)}
                </p>
                <p>Total Outstanding: ₹{getShopBalance(selectedShopForHistory.id).toFixed(2)}</p>
              </div>
              <Button
                onClick={() =>
                  exportData(
                    getShopTransactions(selectedShopForHistory.id),
                    `${selectedShopForHistory.name}_transactions`,
                  )
                }
              >
                <Download className="mr-2 h-4 w-4" />
                Export Data
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

