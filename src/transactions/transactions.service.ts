import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
import { Account } from 'src/accounts/entities/account.entity';
import { TenantService } from 'src/tenant/tenant/tenant.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { Transaction, TransactionType } from './entities/transaction.entity';

@Injectable()
export class TransactionsService {
  constructor(
    @InjectModel(Transaction)
    private readonly transactionModel: typeof Transaction,
    @InjectModel(Account)
    private readonly accountModel: typeof Account,
    private tenantService: TenantService,
    private sequelize: Sequelize,
  ) {}

  async create(createTransactionDto: CreateTransactionDto) {
    const atomic = await this.sequelize.transaction();

    try {
      const transaction = await this.transactionModel.create({
        ...createTransactionDto,
        account_id: this.tenantService.tenant.id,
      });

      const account = await this.accountModel.findByPk(transaction.account_id, {
        lock: atomic.LOCK.UPDATE,
        transaction: atomic,
      });

      const amount =
        createTransactionDto.type === TransactionType.DEBIT
          ? -transaction.amount
          : transaction.amount;

      await account.update(
        { balance: account.balance + amount },
        { transaction: atomic },
      );

      await atomic.commit();

      return transaction;
    } catch (e) {
      await atomic.rollback();
      throw e;
    }
  }

  findAll() {
    return this.transactionModel.findAll({
      where: {
        account_id: this.tenantService.tenant.id,
      },
    });
  }
}
