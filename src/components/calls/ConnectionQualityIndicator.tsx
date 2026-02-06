 import { motion } from "framer-motion";
 import { Wifi, WifiOff, Signal, SignalLow, SignalMedium, SignalHigh } from "lucide-react";
 import { ConnectionQuality } from "@/types/calls";
 import { cn } from "@/lib/utils";
 import {
   Tooltip,
   TooltipContent,
   TooltipProvider,
   TooltipTrigger,
 } from "@/components/ui/tooltip";
 
 interface ConnectionQualityIndicatorProps {
   quality: ConnectionQuality | null;
   showDetails?: boolean;
   className?: string;
 }
 
 const getQualityColor = (rating: ConnectionQuality['rating']) => {
   switch (rating) {
     case 'excellent': return 'text-success';
     case 'good': return 'text-success/80';
     case 'fair': return 'text-warning';
     case 'poor': return 'text-destructive/80';
     case 'disconnected': return 'text-destructive';
     default: return 'text-muted-foreground';
   }
 };
 
 const getQualityLabel = (rating: ConnectionQuality['rating']) => {
   switch (rating) {
     case 'excellent': return 'Excelente';
     case 'good': return 'Boa';
     case 'fair': return 'Regular';
     case 'poor': return 'Ruim';
     case 'disconnected': return 'Desconectado';
     default: return 'Conectando...';
   }
 };
 
 const QualityIcon = ({ rating }: { rating: ConnectionQuality['rating'] | undefined }) => {
   if (!rating) return <Signal className="w-4 h-4 animate-pulse" />;
   
   switch (rating) {
     case 'excellent':
       return <SignalHigh className="w-4 h-4" />;
     case 'good':
       return <SignalHigh className="w-4 h-4" />;
     case 'fair':
       return <SignalMedium className="w-4 h-4" />;
     case 'poor':
       return <SignalLow className="w-4 h-4" />;
     case 'disconnected':
       return <WifiOff className="w-4 h-4" />;
     default:
       return <Signal className="w-4 h-4" />;
   }
 };
 
 export const ConnectionQualityIndicator = ({ 
   quality, 
   showDetails = false,
   className 
 }: ConnectionQualityIndicatorProps) => {
   const rating = quality?.rating;
   const colorClass = rating ? getQualityColor(rating) : 'text-muted-foreground';
 
   if (!showDetails) {
     return (
       <TooltipProvider>
         <Tooltip>
           <TooltipTrigger asChild>
             <motion.div
               initial={{ opacity: 0, scale: 0.8 }}
               animate={{ opacity: 1, scale: 1 }}
               className={cn(
                 "flex items-center gap-1 px-2 py-1 rounded-full bg-background/60 backdrop-blur-sm",
                 colorClass,
                 className
               )}
             >
               <QualityIcon rating={rating} />
               {quality && (
                 <span className="text-xs font-medium">{quality.latency}ms</span>
               )}
             </motion.div>
           </TooltipTrigger>
           <TooltipContent side="bottom">
             <div className="text-xs space-y-1">
               <p className="font-medium">{getQualityLabel(rating)}</p>
               {quality && (
                 <>
                   <p>Latência: {quality.latency}ms</p>
                   <p>Bitrate: {quality.bitrate} kbps</p>
                   <p>Perda de pacotes: {quality.packetLoss}</p>
                 </>
               )}
             </div>
           </TooltipContent>
         </Tooltip>
       </TooltipProvider>
     );
   }
 
   return (
     <motion.div
       initial={{ opacity: 0, y: -10 }}
       animate={{ opacity: 1, y: 0 }}
       className={cn(
         "p-3 rounded-xl bg-background/60 backdrop-blur-sm border border-white/10",
         className
       )}
     >
       <div className="flex items-center gap-2 mb-2">
         <div className={cn("flex items-center gap-1", colorClass)}>
           <QualityIcon rating={rating} />
           <span className="text-sm font-medium">{getQualityLabel(rating)}</span>
         </div>
       </div>
       
       {quality && (
         <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
           <div className="flex justify-between">
             <span>Latência</span>
             <span className="font-medium text-foreground">{quality.latency}ms</span>
           </div>
           <div className="flex justify-between">
             <span>Bitrate</span>
             <span className="font-medium text-foreground">{quality.bitrate} kbps</span>
           </div>
           <div className="flex justify-between">
             <span>Jitter</span>
             <span className="font-medium text-foreground">{quality.jitter}ms</span>
           </div>
           <div className="flex justify-between">
             <span>Perda</span>
             <span className="font-medium text-foreground">{quality.packetLoss}</span>
           </div>
         </div>
       )}
     </motion.div>
   );
 };