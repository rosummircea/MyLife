      {kind==='expense'&&period==='Lună'&&!loading&&data&&!invalidRange&&!report.error&&<div className="reportBudgetCarousel"><div className="reportBudgetCarouselTrack" ref={budgetCarouselRef} aria-label="Carduri buget lunar" onScroll={event=>{const el=event.currentTarget;setBudgetCardIndex(Math.round(el.scrollLeft/Math.max(1,el.clientWidth)))}}><div className="reportBudgetSlide"><section className="expenseTotalBudgetStatus" aria-label="Situația bugetului total">
        <div className="expenseTotalBudgetHeader"><div><span>BUGET TOTAL</span><strong>{moneyWhole(totalBudget)}</strong></div><small>Cheltuit din bugete {moneyWhole(budgetedSpent)}</small></div>
        <BudgetProgress compact spent={budgetedSpent} budget={totalBudget}/>
        {budgetDaysRemaining>0&&budgetRemaining>=0&&<div className="expenseTotalBudgetPace"><span>{budgetDaysRemaining} {budgetDaysRemaining===1?'zi rămasă':'zile rămase'}</span><i aria-hidden="true">·</i><strong>{moneyWhole(budgetDailyAvailable)}/zi</strong></div>}
      </section></div><div className="reportBudgetSlide"><section className="reportMonthlySnapshot" aria-label="Rezumatul financiar al lunii">
        <p>{budgetRemaining>=0?<>Ai cheltuit <strong>{moneyWhole(total)}</strong> în luna selectată. În categoriile bugetate mai ai <strong>{moneyWhole(budgetRemaining)}</strong> din bugetul propus și ai încasat <strong>{moneyWhole(incomeTotal)}</strong>. {unbudgetedSpent>0&&<>Din total, <strong>{moneyWhole(unbudgetedSpent)}</strong> sunt deja cheltuieli în categorii fără buget. </>}<span className={`reportBudgetSignal ${budgetCoverage}`}>{budgetCoverage==='available'?`Dacă folosești tot bugetul rămas, cheltuielile lunii ajung la ${moneyWhole(projectedSpending)} și rămâi cu ${moneyWhole(projectedIncomeDifference)} din venituri.`:budgetCoverage==='caution'?`Dacă folosești și tot bugetul rămas, cheltuielile lunii ajung la ${moneyWhole(projectedSpending)}, adică depășești veniturile cu ${moneyWhole(projectedIncomeDifference)}.`:`Cheltuielile au depășit deja veniturile cu ${moneyWhole(Math.max(0,total-incomeTotal))}.`}</span></>:<>Ai cheltuit <strong>{moneyWhole(total)}</strong> în luna selectată. Ai depășit bugetele propuse cu <strong>{moneyWhole(Math.abs(budgetRemaining))}</strong> și ai încasat <strong>{moneyWhole(incomeTotal)}</strong>.</>}</p>
        <div className="reportMonthlySnapshotGrid">
          <div><span>Buget total</span><strong>{moneyWhole(totalBudget)}</strong></div>
          <div><span>Cheltuit în total</span><strong className="reportMoneyExpense">{moneyWhole(total)}</strong></div>
          <div className={budgetRemaining<0?'over':budgetCoverage}><span>{budgetRemaining<0?'Buget depășit cu':'Rămas în bugete'}</span><strong>{moneyWhole(Math.abs(budgetRemaining))}</strong></div>
          <div><span>Încasat</span><strong className="reportMoneyIncome">{moneyWhole(incomeTotal)}</strong></div>
        </div>
      </section></div></div><div className="reportBudgetDots" aria-label="Navigare carduri buget"><button type="button" aria-label="Situația bugetului" aria-current={budgetCardIndex===0?'true':undefined} onClick={()=>{budgetCarouselRef.current?.scrollTo({left:0,behavior:'smooth'});setBudgetCardIndex(0)}}/><button type="button" aria-label="Rezumat financiar" aria-current={budgetCardIndex===1?'true':undefined} onClick={()=>{const el=budgetCarouselRef.current;el?.scrollTo({left:el.clientWidth,behavior:'smooth'});setBudgetCardIndex(1)}}/></div></div>}
      <div className="sectionTitle reportListTitle"><h2>{kind==='income'?'Venituri':'Cheltuieli'} pe categorii</h2><button type="button" className="expenseCollapseAllButton" disabled={!selected&&!showAllTransactions} onClick={()=>{setSelected(null);setShowAllTransactions(false)}}><ChevronsUp size={15}/> Restrânge tot</button></div>
      <div className="expenseList">
        {categories.length === 0 && <div className="emptyState">Nu există {kind==='income'?'venituri':'cheltuieli'} în RON în perioada selectată.</div>}
        {categories.map((item) => {
          const expanded = selected === item.id
          const categoryBudget=monthlyBudgets.get(item.id)
          return (
            <div className="expenseCategory" key={item.id}>
              <button type="button" id={`expense-trigger-${item.id}`} className={`expenseRow ${expanded ? 'selected' : ''}`} aria-expanded={expanded} aria-controls={`expense-details-${item.id}`} onClick={() => setSelected(expanded ? null : item.id)}>
                <CategoryIcon category={item}/>
                <div className="expenseName"><strong>{item.name}</strong><span>{transactionCountLabel(categoryTransactionCounts.get(item.id)??0)}</span>{categoryBudget!==undefined&&<BudgetProgress compact spent={item.amount} budget={categoryBudget}/>}</div>
                <div className="expenseValue"><strong className={reportAmountClass(item.amount,kind)}>{money(item.amount)}</strong><span>{percent(item.percent)}</span></div>
                <ChevronRight size={18} className="expenseChevron" aria-hidden="true"/>
              </button>
              <div id={`expense-details-${item.id}`} hidden={!expanded}>
                {expanded && <SubcategoryDetails key={`${kind}:${item.id}`} onSelectTransaction={onSelectTransaction} category={item} data={data} range={range} period={period} kind={kind}/>}
              </div>
            </div>
          )
        })}
      </div>
      </>}
    </div>
  )
}

function SubcategoryDetails({ category, data, range, period, kind, onSelectTransaction }: { category: ExpenseCategory; data: MyLifeData; range: DateRange; period: ReportPeriod; kind:ReportKind; onSelectTransaction:(transaction:Transaction)=>void }) {
  const [expandedSubcategories, setExpandedSubcategories] = useState<Set<string>>(() => new Set())
  const [selectedBucket,setSelectedBucket]=useState<{key:string;unit:string;label:string}|null>(null)
  const [showCategoryTransactions,setShowCategoryTransactions]=useState(false)
  const [reportView, setReportView] = useState(0)
  const carouselRef = useRef<HTMLDivElement>(null)
  const distribution = subcategoryDistribution(category)
  const gradient = distributionGradient(distribution)
  const subcategoryContributions = useMemo(() => new Map(distribution.map(item => [item.id, expenseContributionTransactions(data.transactions, data.categories, data.splits, range, { categoryId: category.id, subcategoryId: item.id }, kind)])), [data, range.from, range.to, category, kind])
  const categoryContributions = useMemo(() => expenseContributionTransactions(data.transactions,data.categories,data.splits,range,{categoryId:category.id},kind).filter(row=>!selectedBucket||contributionBucketKey(row.transaction,selectedBucket.unit)===selectedBucket.key),[data,range.from,range.to,category.id,selectedBucket,kind])
  const categoryContributionTotal=categoryContributions.reduce((sum,row)=>sum+Math.round(row.amount*100),0)/100
  const [fromYear, fromMonth] = range.from.split('-').map(Number)
  const [toYear, toMonth] = range.to.split('-').map(Number)
  const monthCount = Math.max(1, (toYear - fromYear) * 12 + toMonth - fromMonth + 1)
  const monthlyAverage = Math.round(category.amount * 100 / monthCount) / 100
  const showReport = (index: number) => {
    setReportView(index)
    carouselRef.current?.scrollTo({ left: carouselRef.current.clientWidth * index, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  }

  const toggleSubcategory = (id: string) => {
    const closing = expandedSubcategories.has(id)
    setExpandedSubcategories(current => {
      const next = new Set(current)
      if (closing) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <section className="expenseDetails" aria-labelledby={`expense-trigger-${category.id}`}>
      <div className="expenseSubcategories">
        <ul>
          {distribution.map((item) => {
            const expanded = expandedSubcategories.has(item.id)
            const rows = subcategoryContributions.get(item.id) ?? []
            return (
            <li key={item.id} className="expenseSubcategory">
              <button type="button" id={`expense-subcategory-${item.id}`} className="expenseSubcategoryButton" aria-expanded={expanded} aria-controls={`expense-transactions-${item.id}`} onClick={() => toggleSubcategory(item.id)}>
                <span className="expenseSubcategorySwatch" aria-hidden="true" style={{backgroundColor:item.color}}/>
                <span className="expenseSubcategoryMeta"><span className="expenseSubcategoryName">{item.name}</span><small>{transactionCountLabel(rows.length)}</small></span>
                <strong className={reportAmountClass(item.amount,kind)}>{money(item.amount)}</strong>
                <span className="expenseSubcategoryPercent">{item.percent.toLocaleString('ro-RO', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%</span>
                <ChevronRight size={14} className="expenseChevron" aria-hidden="true"/>
              </button>
              <div id={`expense-transactions-${item.id}`} hidden={!expanded} className="expenseSubcategoryTransactions" role="region" aria-labelledby={`expense-subcategory-${item.id}`} style={{borderLeftColor:item.color}}>
                {expanded && <>
                  <p className="expenseInlineCaption">{rows.length} tranzacții · {range.from} – {range.to} · Apasă pentru detalii și editare.</p>
                  <TransactionsList accounts={data.accounts} categories={data.categories} splits={data.splits} transactions={rows.map(row=>row.transaction)} contributionAmounts={Object.fromEntries(rows.map(row=>[row.transaction.id,row.amount]))} onSelect={onSelectTransaction} emptyMessage="Nu există tranzacții pentru suma și perioada selectate."/>
                  {rows.length>0&&<div className="expenseSubcategoryTrend"><ExpenseTrendChart
                    compact
                    key={`subcategory-${item.id}-${range.from}-${range.to}-${period}`}
                    data={data}
                    range={range}
                    period={period}
                    target={{categoryId:category.id,subcategoryId:item.id}}
                    name={`${category.name} · ${item.name}`}
                    color={item.color}
                    kind={kind}
                  /></div>}
                  {rows.some(row=>Math.round(row.amount*100)!==Math.round(Number(row.transaction.amount)*100)) && <p className="expenseReportNote">Sumele reprezintă partea repartizată aici; suma integrală este indicată separat.</p>}
                </>}
              </div>
            </li>
            )
          })}
        </ul>
      </div>
      <div className="expenseReportDeck">
        <header className="expenseReportDeckHeader">
          <div><p className="expenseTrendEyebrow">RAPOARTE CATEGORIE</p><h3>{category.name}</h3><p>Glisează pentru a schimba reprezentarea.</p></div>
          <div className="expenseReportDeckTotals"><span>Total în perioadă</span><strong className={reportAmountClass(category.amount,kind)}>{money(category.amount)}</strong><small>Medie pe lună · <b className={reportAmountClass(monthlyAverage,kind)}>{money(monthlyAverage)}</b></small></div>
        </header>
        <div className="expenseReportViewSwitch" role="tablist" aria-label="Tipul graficului">
          <button type="button" role="tab" aria-selected={reportView===0} onClick={()=>showReport(0)}>Distribuție</button>
          <button type="button" role="tab" aria-selected={reportView===1} onClick={()=>showReport(1)}>Evoluție</button>
        </div>
        <div className="expenseReportCarousel" ref={carouselRef} onScroll={event => {
          const element = event.currentTarget
          const next = Math.round(element.scrollLeft / Math.max(1, element.clientWidth))
          if (next !== reportView) setReportView(next)
        }}>
          <section className="expenseReportSlide expenseReportPieSlide" aria-label={`Distribuția subcategoriilor pentru ${category.name}`}>
            <div className="expenseSubchart" role="img" aria-label={`Distribuția subcategoriilor pentru ${category.name}: ${distribution.map((item) => `${item.name} ${item.percent.toLocaleString('ro-RO')}%`).join(', ')}`} style={{ background: `conic-gradient(${gradient})` }}>
              <div className="expenseSubchartHole"><span>Total categorie</span><strong className={reportAmountClass(category.amount,kind)}>{money(category.amount)}</strong></div>
            </div>
          </section>
          <section className="expenseReportSlide expenseReportTrendSlide" aria-label={`Evoluția ${kind==='income'?'veniturilor':'cheltuielilor'} pentru ${category.name}`}>
            <ExpenseTrendChart
              compact
              key={`${category.id}-${range.from}-${range.to}-${period}`}
              data={data}
              range={range}
              period={period}
              target={{categoryId:category.id}}
              name={category.name}
              color={category.color}
              kind={kind}
              onSelectPoint={(key,unit,label)=>{
                setSelectedBucket({key,unit,label})
                setShowCategoryTransactions(true)
              }}
              onSelectTotal={()=>{
                setSelectedBucket(null)
                setShowCategoryTransactions(true)
              }}
            />
          </section>
        </div>
      </div>
      {showCategoryTransactions && <section className="expenseContributionList expenseCategoryPeriodTransactions" aria-label={`Tranzacțiile ${category.name}`}>
        <header>
          <div><h3>Tranzacții · {category.name}</h3><p>{selectedBucket?.label ?? `${range.from} – ${range.to}`} · {categoryContributions.length} tranzacții · Apasă pentru detalii și editare.</p></div>
          <div className="expenseContributionActions"><strong className={reportAmountClass(categoryContributionTotal,kind)}>{money(categoryContributionTotal)}</strong><button type="button" className="expenseCategoryTrendButton" onClick={()=>{setShowCategoryTransactions(false);setSelectedBucket(null)}}>Închide</button></div>
        </header>
        <TransactionsList accounts={data.accounts} categories={data.categories} splits={data.splits} transactions={categoryContributions.map(row=>row.transaction)} contributionAmounts={Object.fromEntries(categoryContributions.map(row=>[row.transaction.id,row.amount]))} onSelect={onSelectTransaction} emptyMessage="Nu există tranzacții pentru intervalul selectat."/>
      </section>}
    </section>
  )
}
