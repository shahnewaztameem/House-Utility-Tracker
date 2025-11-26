<?php

namespace App\Enums;

enum BillStatus: string
{
    case DRAFT = 'draft';
    case ISSUED = 'issued';
    case PARTIAL = 'partial';
    case PAID = 'paid';
    case OVERDUE = 'overdue';

    public function isClosed(): bool
    {
        return in_array($this, [self::PAID], true);
    }
}

