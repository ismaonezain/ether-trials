'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useTRIAContractv6 } from '@/hooks/useTRIAContractv6';
import { Coins, TrendingUp, Wallet, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export function AdminPanelV6() {
  const {
    balances,
    periodInfo,
    actualPeriodInfo,
    actualCurrentPeriod,
    withdrawBuyback,
    withdrawTreasury,
    finalizePeriod,
    isLoading,
    isSuccess,
    error,
    refetchAll,
    currentPeriod,
  } = useTRIAContractv6();

  const [lastAction, setLastAction] = useState<string | null>(null);

  const handleWithdrawBuyback = async () => {
    setLastAction('buyback');
    await withdrawBuyback();
    setTimeout(() => {
      refetchAll();
      setLastAction(null);
    }, 2000);
  };

  const handleWithdrawTreasury = async () => {
    setLastAction('treasury');
    await withdrawTreasury();
    setTimeout(() => {
      refetchAll();
      setLastAction(null);
    }, 2000);
  };

  const handleFinalizePeriod = async () => {
    if (actualCurrentPeriod === undefined) return;
    setLastAction('finalize');
    await finalizePeriod(actualCurrentPeriod);
    setTimeout(() => {
      refetchAll();
      setLastAction(null);
    }, 2000);
  };

  // Use actualPeriodInfo for finalization check (period that needs to be finalized)
  const canFinalize = actualPeriodInfo && !actualPeriodInfo.finalized && (actualPeriodInfo.status === 'ended' || actualPeriodInfo.timeRemaining === 0);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h2 className="text-2xl font-bold">V6 Admin Panel</h2>
        <p className="text-gray-600">Manage buyback and treasury withdrawals</p>
      </div>

      {/* Success/Error Messages */}
      {isSuccess && lastAction && (
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            {lastAction === 'buyback' && 'Buyback TRIA withdrawn successfully!'}
            {lastAction === 'treasury' && 'Treasury ETH withdrawn successfully!'}
            {lastAction === 'finalize' && 'Period finalized successfully!'}
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert className="bg-red-50 border-red-200">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">{error}</AlertDescription>
        </Alert>
      )}

      {/* Balances Overview */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Coins className="w-5 h-5 text-purple-500" />
              Buyback TRIA Balance
            </CardTitle>
            <CardDescription>
              Accumulated TRIA from entry fees (10%) and dice payments (80%)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-3xl font-bold text-purple-600">
                {balances.buybackTRIA} TRIA
              </div>
              <Button
                onClick={handleWithdrawBuyback}
                disabled={isLoading || parseFloat(balances.buybackTRIA) === 0}
                className="w-full"
              >
                {isLoading && lastAction === 'buyback' ? 'Withdrawing...' : 'Withdraw Buyback TRIA'}
              </Button>
              <p className="text-xs text-gray-500">
                * Sources: 10% from entry fees + 80% from dice payments
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Wallet className="w-5 h-5 text-blue-500" />
              Treasury ETH Balance
            </CardTitle>
            <CardDescription>
              Accumulated ETH from entry fees (5%) and dice payments (20%)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-3xl font-bold text-blue-600">
                {balances.treasury} ETH
              </div>
              <Button
                onClick={handleWithdrawTreasury}
                disabled={isLoading || parseFloat(balances.treasury) === 0}
                className="w-full"
                variant="secondary"
              >
                {isLoading && lastAction === 'treasury' ? 'Withdrawing...' : 'Withdraw Treasury ETH'}
              </Button>
              <p className="text-xs text-gray-500">
                * Sources: 5% from entry fees + 20% from dice payments
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* Period Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-green-500" />
            Period Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          {actualPeriodInfo && (
            <div className="space-y-4">
              <Alert className="bg-blue-50 border-blue-200 mb-4">
                <AlertCircle className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-800">
                  <strong>Period to Finalize:</strong> #{actualPeriodInfo.periodNumber.toString()} ({actualPeriodInfo.status})
                  {periodInfo && periodInfo.periodNumber !== actualPeriodInfo.periodNumber && (
                    <span className="ml-2">| <strong>Next Period:</strong> #{periodInfo.periodNumber.toString()}</span>
                  )}
                </AlertDescription>
              </Alert>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Period to Finalize</p>
                  <p className="text-2xl font-bold">#{actualPeriodInfo.periodNumber.toString()}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Status</p>
                  <Badge variant={actualPeriodInfo.finalized ? 'secondary' : actualPeriodInfo.status === 'ended' ? 'destructive' : 'default'}>
                    {actualPeriodInfo.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-gray-600">TRIA Prize Pool</p>
                  <p className="text-xl font-semibold">{(Number(actualPeriodInfo.triaPool) / 1e18).toFixed(4)} TRIA</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Participants</p>
                  <p className="text-xl font-semibold">{actualPeriodInfo.participantCount.toString()}</p>
                </div>
              </div>

              {canFinalize && (
                <Button
                  onClick={handleFinalizePeriod}
                  disabled={isLoading}
                  className="w-full"
                  variant="destructive"
                >
                  {isLoading && lastAction === 'finalize' ? 'Finalizing...' : `Finalize Period #${actualPeriodInfo.periodNumber.toString()}`}
                </Button>
              )}

              {!canFinalize && actualPeriodInfo.finalized && (
                <Alert className="bg-green-50 border-green-200">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800">
                    Period #{actualPeriodInfo.periodNumber.toString()} is already finalized!
                  </AlertDescription>
                </Alert>
              )}

              {!canFinalize && !actualPeriodInfo.finalized && actualPeriodInfo.timeRemaining > 0 && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Period ends in {Math.floor(actualPeriodInfo.timeRemaining / 3600)}h {Math.floor((actualPeriodInfo.timeRemaining % 3600) / 60)}m
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="bg-gradient-to-br from-purple-50 to-blue-50 border-purple-200">
        <CardHeader>
          <CardTitle className="text-lg">Revenue Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div>
              <p className="font-semibold text-purple-900">Entry Fees (100%):</p>
              <ul className="ml-4 mt-1 space-y-1 text-purple-800">
                <li>• 85% → Prize pool (TRIA)</li>
                <li>• 10% → Buyback (TRIA)</li>
                <li>• 5% → Treasury (ETH)</li>
              </ul>
            </div>
            <Separator />
            <div>
              <p className="font-semibold text-blue-900">Dice Payments (100%):</p>
              <ul className="ml-4 mt-1 space-y-1 text-blue-800">
                <li>• 80% → Buyback (TRIA)</li>
                <li>• 20% → Treasury (ETH)</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
