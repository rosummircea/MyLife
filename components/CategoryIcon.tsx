import {Tag,Utensils,House,Car,HeartPulse,Shield,Gift,Plane,ShoppingBag,Dumbbell,PawPrint,Baby,Wallet,Zap,Coffee,GraduationCap} from 'lucide-react'
import {categoryAppearance} from '@/lib/category-display'
import type {CategoryRow} from '@/lib/mylife-data'
const icons={tag:Tag,food:Utensils,home:House,car:Car,health:HeartPulse,shield:Shield,gift:Gift,plane:Plane,shopping:ShoppingBag,sport:Dumbbell,pet:PawPrint,child:Baby,wallet:Wallet,utilities:Zap,coffee:Coffee,education:GraduationCap}
export default function CategoryIcon({category}:{category?:Pick<CategoryRow,'id'|'name'|'icon'|'color'>}){const {icon,color}=categoryAppearance(category);const Icon=icons[icon as keyof typeof icons]??Tag;return <span className="categoryIcon" style={{color,backgroundColor:`${color}18`,display:'inline-flex',flexShrink:0,alignItems:'center',justifyContent:'center',width:30,height:30,borderRadius:9}} aria-hidden="true"><Icon size={17}/></span>}
