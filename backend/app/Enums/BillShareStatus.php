<?php

namespace App\Enums;

enum BillShareStatus: string
{
    case PENDING = 'pending';
    case PARTIAL = 'partial';
    case PAID = 'paid';
}

