'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { formatEther } from 'viem';
import { useTRIAContractv9 } from '@/hooks/useTRIAContractv9';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Loader2, 
  Play, 
  DollarSign, 
  Settings, 
  Pause, 
  PlayCircle, 
  AlertCircle,
  LayoutDashboard,
  TrendingUp,
  Users,
  Clock,
  Award,
  Wallet,
  Shield
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface AdminModalV9Props {
  isOpen: boolean;
  onClose: () => void;
}

export function AdminModalV9({ isOpen, onClose }: AdminModalV9Props) {
  const { address } = useAccount();
  const {
    currentPeriod,
    periodInfo,
    settings,
    balances,
    constants,
    allocatePrizes,
    startNewPeriod,
    pauseContract,
    unpauseContract,
    setV3Fee,
    setEntryBounds,
    withdrawBuyback,
    withdrawTreasury,
    isPending,
    error,
  } = useTRIAContractv9();

  // Settings form
  const [newV3Fee, setNewV3Fee] = useState<string>('10000');
  const [newMinEntry, setNewMinEntry] = useState<string>('0.00001');
  const [newMaxEntry, setNewMaxEntry] = useState<string>('1');

  // Auto-refresh data every 10s
  useEffect(() => {
    if (isOpen) {
      const interval = setInterval(() => {
        // Data will auto-refresh via wagmi hooks
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  const handleAllocatePrizes = async () => {
    if (!currentPeriod) return;
    await allocatePrizes(currentPeriod);
  };

  const handleStartNewPeriod = async () => {
    await startNewPeriod();
  };

  const handlePauseToggle = async () => {
    if (settings.paused) {
      await unpauseContract();
    } else {
      await pauseContract();
    }
  };

  const handleUpdateV3Fee = async () => {
    const fee = parseInt(newV3Fee);
    if (![500, 3000, 10000].includes(fee)) {
      alert('Invalid fee tier. Must be 500, 3000, or 10000');
      return;
    }
    await setV3Fee(fee);
  };

  const handleUpdateEntryBounds = async () => {
    try {
      const minWei = BigInt(Math.floor(parseFloat(newMinEntry) * 1e18));
      const maxWei = BigInt(Math.floor(parseFloat(newMaxEntry) * 1e18));
      
      if (minWei <= 0n || maxWei < minWei) {
        alert('Invalid entry bounds');
        return;
      }
      
      await setEntryBounds(minWei.toString(), maxWei.toString());
    } catch (err) {
      alert('Error parsing entry bounds');
    }
  };

  const handleWithdrawBuyback = async () => {
    await withdrawBuyback();
  };

  const handleWithdrawTreasury = async () => {
    await withdrawTreasury();
  };

  const getFeeLabel = (fee: number): string => {
    if (fee === 500) return '0.05%';
    if (fee === 3000) return '0.3%';
    if (fee === 10000) return '1%';
    return `${(fee / 10000).toFixed(2)}%`;
  };

  if (!periodInfo) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">Admin Panel V9</DialogTitle>
            <DialogDescription>Tournament Management Dashboard</DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center py-24">
            <div className="text-center space-y-4">
              <Loader2 className="w-12 h-12 animate-spin text-blue-500 mx-auto" />
              <p className="text-lg text-gray-600">Loading contract data...</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const now = BigInt(Math.floor(Date.now() / 1000));
  const canAllocate = !periodInfo.allocated && now >= periodInfo.endTime + BigInt(constants.revealWindow) && periodInfo.totalPoints > 0n;
  const canStartNew = periodInfo.allocated && now >= periodInfo.endTime;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="pb-4 border-b">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-2xl font-bold flex items-center gap-3">
                <Shield className="w-6 h-6 text-blue-500" />
                Admin Panel V9
              </DialogTitle>
              <DialogDescription className="mt-1">Tournament Management Dashboard</DialogDescription>
            </div>
            <div className="flex gap-2">
              <Badge 
                variant={settings.paused ? 'destructive' : 'default'}
                className="h-8 px-4 text-sm"
              >
                {settings.paused ? '⏸️ PAUSED' : '▶️ ACTIVE'}
              </Badge>
              <Badge variant="outline" className="h-8 px-4 text-sm">
                Period {currentPeriod.toString()}
              </Badge>
            </div>
          </div>
        </DialogHeader>

        {/* Error Display */}
        {error && (
          <Alert variant="destructive" className="mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error.message || 'Transaction failed'}</AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="overview" className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-4 mb-4">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <LayoutDashboard className="w-4 h-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="period" className="flex items-center gap-2">
              <Play className="w-4 h-4" />
              Period
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Settings
            </TabsTrigger>
            <TabsTrigger value="balances" className="flex items-center gap-2">
              <Wallet className="w-4 h-4" />
              Treasury
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto pr-2">
            {/* OVERVIEW TAB */}
            <TabsContent value="overview" className="space-y-4 mt-0">
              {/* Key Metrics Grid */}
              <div className="grid grid-cols-4 gap-4">
                <Card className="border-l-4 border-l-blue-500">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      Participants
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold text-blue-600">
                      {periodInfo.participants.toString()}
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-l-4 border-l-purple-500">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
                      <Award className="w-4 h-4" />
                      Total Points
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold text-purple-600">
                      {periodInfo.totalPoints.toString()}
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-l-4 border-l-green-500">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
                      <DollarSign className="w-4 h-4" />
                      ETH Pool
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold text-green-600">
                      {parseFloat(formatEther(periodInfo.ethPrizePool)).toFixed(4)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">ETH</p>
                  </CardContent>
                </Card>

                <Card className="border-l-4 border-l-orange-500">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4" />
                      TRIA Pool
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold text-orange-600">
                      {parseFloat(formatEther(periodInfo.triaPrizePool)).toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">TRIA</p>
                  </CardContent>
                </Card>
              </div>

              {/* Period Status */}
              <Card className="bg-gradient-to-br from-blue-50 to-purple-50 border-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-blue-600" />
                    Current Period Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm font-medium text-gray-600 mb-1">Period Number</p>
                        <Badge variant="outline" className="text-lg px-4 py-1">
                          #{currentPeriod.toString()}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-600 mb-1">Status</p>
                        <Badge 
                          variant={periodInfo.allocated ? 'secondary' : 'default'}
                          className="text-sm px-3 py-1"
                        >
                          {periodInfo.allocated ? 'Allocated' : 'Active'}
                        </Badge>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <p className="text-sm font-medium text-gray-600 mb-1">Start Time</p>
                        <p className="text-sm font-mono bg-white/80 px-3 py-1.5 rounded border">
                          {new Date(Number(periodInfo.startTime) * 1000).toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-600 mb-1">End Time</p>
                        <p className="text-sm font-mono bg-white/80 px-3 py-1.5 rounded border">
                          {new Date(Number(periodInfo.endTime) * 1000).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>

                  <Separator className="my-4" />

                  <div className="bg-white/80 rounded-lg p-4 border">
                    <p className="text-sm font-medium text-gray-600 mb-2">Time Remaining</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {now < periodInfo.endTime
                        ? `${Math.floor(Number(periodInfo.endTime - now) / 3600)}h ${Math.floor((Number(periodInfo.endTime - now) % 3600) / 60)}m`
                        : '⏱️ Period Ended'}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Contract Constants */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Contract Configuration</CardTitle>
                  <CardDescription>Immutable contract constants</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-4 gap-4">
                    <div className="text-center p-4 bg-gray-50 rounded-lg border">
                      <p className="text-xs text-gray-500 mb-1">Free Dice/Period</p>
                      <p className="text-2xl font-bold text-gray-800">{constants.freeDice}</p>
                    </div>
                    <div className="text-center p-4 bg-gray-50 rounded-lg border">
                      <p className="text-xs text-gray-500 mb-1">Max Paid Rolls</p>
                      <p className="text-2xl font-bold text-gray-800">{constants.maxPaidRolls}</p>
                    </div>
                    <div className="text-center p-4 bg-gray-50 rounded-lg border">
                      <p className="text-xs text-gray-500 mb-1">Reveal Window</p>
                      <p className="text-2xl font-bold text-gray-800">{constants.revealWindow / 60}m</p>
                    </div>
                    <div className="text-center p-4 bg-gray-50 rounded-lg border">
                      <p className="text-xs text-gray-500 mb-1">Max Score</p>
                      <p className="text-2xl font-bold text-gray-800">{constants.maxScore.toLocaleString()}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* PERIOD MANAGEMENT TAB */}
            <TabsContent value="period" className="space-y-4 mt-0">
              <Card className="border-2 border-blue-200 bg-blue-50/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <Play className="w-6 h-6 text-blue-600" />
                    Period Lifecycle Management
                  </CardTitle>
                  <CardDescription>
                    Allocate prizes and start new tournament periods
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Action Buttons */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <div className="bg-white p-4 rounded-lg border-2 border-green-200">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h4 className="font-semibold text-lg mb-1">Allocate Prizes</h4>
                            <p className="text-sm text-gray-600">
                              Convert ETH to TRIA via Uniswap V3 and distribute to players
                            </p>
                          </div>
                          <Badge variant={canAllocate ? 'default' : 'secondary'}>
                            {canAllocate ? '✅ Ready' : '⏳ Waiting'}
                          </Badge>
                        </div>
                        <Button
                          onClick={handleAllocatePrizes}
                          disabled={!canAllocate || isPending}
                          className="w-full h-12"
                          variant={canAllocate ? 'default' : 'secondary'}
                          size="lg"
                        >
                          {isPending ? (
                            <>
                              <Loader2 className="w-5 h-5 animate-spin mr-2" />
                              Processing...
                            </>
                          ) : (
                            <>
                              <DollarSign className="w-5 h-5 mr-2" />
                              Allocate Prizes Now
                            </>
                          )}
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="bg-white p-4 rounded-lg border-2 border-blue-200">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h4 className="font-semibold text-lg mb-1">Start New Period</h4>
                            <p className="text-sm text-gray-600">
                              Begin the next 24-hour tournament
                            </p>
                          </div>
                          <Badge variant={canStartNew ? 'default' : 'secondary'}>
                            {canStartNew ? '✅ Ready' : '⏳ Waiting'}
                          </Badge>
                        </div>
                        <Button
                          onClick={handleStartNewPeriod}
                          disabled={!canStartNew || isPending}
                          className="w-full h-12"
                          variant={canStartNew ? 'default' : 'secondary'}
                          size="lg"
                        >
                          {isPending ? (
                            <>
                              <Loader2 className="w-5 h-5 animate-spin mr-2" />
                              Processing...
                            </>
                          ) : (
                            <>
                              <PlayCircle className="w-5 h-5 mr-2" />
                              Start New Period
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Requirements */}
                  <Alert className="bg-blue-50 border-blue-200">
                    <AlertCircle className="h-4 w-4 text-blue-600" />
                    <AlertDescription className="text-sm">
                      <strong>Requirements:</strong>
                      <ul className="mt-2 space-y-1 list-disc list-inside">
                        <li><strong>Allocate:</strong> Period must be ended + reveal window passed + has participants</li>
                        <li><strong>Start New:</strong> Prizes must be allocated first</li>
                      </ul>
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            </TabsContent>

            {/* SETTINGS TAB */}
            <TabsContent value="settings" className="space-y-4 mt-0">
              {/* Contract Pause Control */}
              <Card className="border-2 border-orange-200 bg-orange-50/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-orange-600" />
                    Emergency Controls
                  </CardTitle>
                  <CardDescription>Pause or resume contract operations</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between p-4 bg-white rounded-lg border-2">
                    <div>
                      <p className="font-semibold text-lg mb-1">Contract Status</p>
                      <p className="text-sm text-gray-600">
                        Currently: <strong className={settings.paused ? 'text-red-600' : 'text-green-600'}>
                          {settings.paused ? '⏸️ PAUSED' : '▶️ ACTIVE'}
                        </strong>
                      </p>
                    </div>
                    <Button
                      onClick={handlePauseToggle}
                      disabled={isPending}
                      variant={settings.paused ? 'default' : 'destructive'}
                      size="lg"
                      className="px-8"
                    >
                      {isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : settings.paused ? (
                        <>
                          <PlayCircle className="w-4 h-4 mr-2" />
                          Unpause
                        </>
                      ) : (
                        <>
                          <Pause className="w-4 h-4 mr-2" />
                          Pause
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Uniswap V3 Fee Settings */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="w-5 h-5 text-blue-600" />
                    Uniswap V3 Fee Configuration
                  </CardTitle>
                  <CardDescription>
                    Configure swap fee tier for ETH → TRIA conversion via Uniswap V3
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Current Settings Display */}
                  <div className="p-4 bg-blue-50 rounded-lg border-2 border-blue-200 text-center">
                    <p className="text-xs text-gray-600 mb-1">Current Fee Tier</p>
                    <p className="text-3xl font-bold text-blue-600">
                      {getFeeLabel(settings.v3Fee)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Fee: {settings.v3Fee}</p>
                  </div>

                  <Separator />

                  {/* Update Form */}
                  <div className="space-y-3">
                    <Label className="text-base font-semibold">Update Fee Tier</Label>
                    <Select value={newV3Fee} onValueChange={setNewV3Fee}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select fee tier" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="500">
                          <div className="flex items-center justify-between w-full">
                            <span>0.05% Fee</span>
                            <Badge variant="outline" className="ml-4">500</Badge>
                          </div>
                        </SelectItem>
                        <SelectItem value="3000">
                          <div className="flex items-center justify-between w-full">
                            <span>0.3% Fee</span>
                            <Badge variant="outline" className="ml-4">3000</Badge>
                          </div>
                        </SelectItem>
                        <SelectItem value="10000">
                          <div className="flex items-center justify-between w-full">
                            <span>1% Fee (Default)</span>
                            <Badge variant="outline" className="ml-4">10000</Badge>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>

                    <Alert className="bg-yellow-50 border-yellow-200">
                      <AlertCircle className="h-4 w-4 text-yellow-600" />
                      <AlertDescription className="text-sm">
                        <strong>Note:</strong> Uniswap V3 has standard fee tiers: 0.05%, 0.3%, and 1%. Make sure the pool exists for the selected fee tier.
                      </AlertDescription>
                    </Alert>

                    <Button 
                      onClick={handleUpdateV3Fee} 
                      disabled={isPending} 
                      className="w-full"
                      size="lg"
                    >
                      {isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          Updating...
                        </>
                      ) : (
                        <>
                          <Settings className="w-4 h-4 mr-2" />
                          Update V3 Fee Tier
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Entry Bounds */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-green-600" />
                    Entry Fee Bounds
                  </CardTitle>
                  <CardDescription>
                    Set minimum and maximum tournament entry amounts
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Current Bounds Display */}
                  <div className="grid grid-cols-2 gap-4 p-4 bg-green-50 rounded-lg border-2 border-green-200">
                    <div className="text-center">
                      <p className="text-xs text-gray-600 mb-1">Current Min Entry</p>
                      <p className="text-2xl font-bold text-green-600">
                        {settings.minEntry}
                      </p>
                      <p className="text-xs text-gray-500">ETH</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-600 mb-1">Current Max Entry</p>
                      <p className="text-2xl font-bold text-green-600">
                        {settings.maxEntry}
                      </p>
                      <p className="text-xs text-gray-500">ETH</p>
                    </div>
                  </div>

                  <Separator />

                  {/* Update Form */}
                  <div className="space-y-3">
                    <Label className="text-base font-semibold">Update Entry Bounds</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="minEntry" className="text-xs text-gray-600">
                          Minimum Entry (ETH)
                        </Label>
                        <Input
                          id="minEntry"
                          type="number"
                          step="0.00001"
                          value={newMinEntry}
                          onChange={(e) => setNewMinEntry(e.target.value)}
                          placeholder="0.00001"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="maxEntry" className="text-xs text-gray-600">
                          Maximum Entry (ETH)
                        </Label>
                        <Input
                          id="maxEntry"
                          type="number"
                          step="0.1"
                          value={newMaxEntry}
                          onChange={(e) => setNewMaxEntry(e.target.value)}
                          placeholder="1"
                          className="mt-1"
                        />
                      </div>
                    </div>
                    <Button 
                      onClick={handleUpdateEntryBounds} 
                      disabled={isPending} 
                      className="w-full"
                      size="lg"
                    >
                      {isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          Updating...
                        </>
                      ) : (
                        <>
                          <DollarSign className="w-4 h-4 mr-2" />
                          Update Entry Bounds
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* TREASURY TAB */}
            <TabsContent value="balances" className="space-y-4 mt-0">
              {/* Balance Overview */}
              <div className="grid grid-cols-3 gap-4">
                <Card className="border-2 border-green-200 bg-green-50/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm text-gray-600">Treasury (ETH)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold text-green-600 mb-1">
                      {parseFloat(balances.treasury).toFixed(5)}
                    </p>
                    <p className="text-xs text-gray-500">ETH</p>
                  </CardContent>
                </Card>

                <Card className="border-2 border-purple-200 bg-purple-50/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm text-gray-600">Buyback (TRIA)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold text-purple-600 mb-1">
                      {parseFloat(balances.buyback).toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-500">TRIA</p>
                  </CardContent>
                </Card>

                <Card className="border-2 border-orange-200 bg-orange-50/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm text-gray-600">Prize Owed (TRIA)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold text-orange-600 mb-1">
                      {parseFloat(balances.totalPrizeOwed).toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-500">TRIA</p>
                  </CardContent>
                </Card>
              </div>

              {/* Withdraw Actions */}
              <Card className="border-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Wallet className="w-5 h-5 text-blue-600" />
                    Withdraw Funds
                  </CardTitle>
                  <CardDescription>
                    Withdraw accumulated treasury and buyback balances
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-green-50 rounded-lg border-2 border-green-200">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="font-semibold mb-1">Treasury ETH</p>
                          <p className="text-2xl font-bold text-green-600">
                            {parseFloat(balances.treasury).toFixed(5)} ETH
                          </p>
                        </div>
                      </div>
                      <Button
                        onClick={handleWithdrawTreasury}
                        disabled={isPending || parseFloat(balances.treasury) === 0}
                        className="w-full"
                        size="lg"
                        variant="outline"
                      >
                        {isPending ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            Withdrawing...
                          </>
                        ) : (
                          <>
                            <DollarSign className="w-4 h-4 mr-2" />
                            Withdraw Treasury
                          </>
                        )}
                      </Button>
                    </div>

                    <div className="p-4 bg-purple-50 rounded-lg border-2 border-purple-200">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="font-semibold mb-1">Buyback TRIA</p>
                          <p className="text-2xl font-bold text-purple-600">
                            {parseFloat(balances.buyback).toFixed(2)} TRIA
                          </p>
                        </div>
                      </div>
                      <Button
                        onClick={handleWithdrawBuyback}
                        disabled={isPending || parseFloat(balances.buyback) === 0}
                        className="w-full"
                        size="lg"
                        variant="outline"
                      >
                        {isPending ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            Withdrawing...
                          </>
                        ) : (
                          <>
                            <DollarSign className="w-4 h-4 mr-2" />
                            Withdraw Buyback
                          </>
                        )}
                      </Button>
                    </div>
                  </div>

                  <Alert className="bg-blue-50 border-blue-200">
                    <AlertCircle className="h-4 w-4 text-blue-600" />
                    <AlertDescription className="text-sm">
                      <strong>Note:</strong> Withdrawals transfer funds to the contract owner address ({address?.slice(0, 6)}...{address?.slice(-4)})
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
